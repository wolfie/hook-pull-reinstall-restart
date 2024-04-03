import EventSource from 'eventsource';
import querystring from 'querystring';

/**
 * @typedef {(headers:Record<string,string|undefined>,body:string)=>void} OnEvent
 */

/**
 * @param {OnEvent} onEvent
 * @returns {(msg:MessageEvent)=>Promise<void>}
 */
const onMessage = (onEvent) => async (msg) => {
  const data = JSON.parse(msg.data);
  const body = JSON.stringify(data.body);
  /** @type {Record<string,string>} */
  const headers = {};
  Object.keys(data).forEach((key) => (headers[key] = data[key]));
  headers['content-length'] = Buffer.byteLength(body).toString();
  onEvent(headers, body);
};

/**
 * @param {{
 *  eventSourceUrl:string,
 *  onConnecting?:(args:{source:string})=>void,
 *  onConnected?:()=>void,
 *  onError?:(error:any)=>void,
 *  onEvent:OnEvent
 * }} args
 */
const connectToSmee = ({
  eventSourceUrl,
  onConnecting,
  onConnected,
  onError,
  onEvent,
}) =>
  new Promise((resolve, reject) => {
    const source = eventSourceUrl.startsWith('https://smee.io')
      ? eventSourceUrl
      : `https://smee.io/${querystring.escape(eventSourceUrl)}`;
    const events = new EventSource(source);

    if (!URL.canParse(source)) {
      return reject(new Error(`${eventSourceUrl} is not a valid URL`));
    }

    onConnecting?.({ source });

    // Reconnect immediately
    // @ts-ignore
    events.reconnectInterval = 0; // This isn't a valid property of EventSource
    events.addEventListener('message', onMessage(onEvent));
    events.addEventListener('open', () => {
      onConnected?.();
      resolve(undefined);
    });
    events.addEventListener('error', (err) => {
      reject(err);
      onError?.(err.status === 404 ? 'No such channel: ' + source : err);
    });
  });

export default connectToSmee;
