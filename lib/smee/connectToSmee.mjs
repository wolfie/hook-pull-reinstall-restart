import EventSource from "eventsource";
import url from "url";
import querystring from "querystring";

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
  headers["content-length"] = Buffer.byteLength(body).toString();
  onEvent(headers, body);
};

/**
 * @param {{
 *  smeeChannelId:string,
 *  onConnecting?:(args:{source:string})=>void,
 *  onConnected?:()=>void,
 *  onError?:(error:any)=>void,
 *  onEvent:OnEvent
 * }} args
 */
const connectToSmee = ({
  smeeChannelId,
  onConnecting,
  onConnected,
  onError,
  onEvent,
}) =>
  new Promise((resolve, reject) => {
    const source = `https://smee.io/${querystring.escape(smeeChannelId)}`;
    const events = new EventSource(source);

    try {
      new URL(source);
    } catch (e) {
      reject(e);
    }

    onConnecting?.({ source });

    // Reconnect immediately
    // @ts-ignore
    events.reconnectInterval = 0; // This isn't a valid property of EventSource
    events.addEventListener("message", onMessage(onEvent));
    events.addEventListener("open", () => {
      onConnected?.();
      resolve(undefined);
    });
    events.addEventListener("error", (err) => {
      reject(err);
      onError?.(err.status === 404 ? "No such channel: " + source : err);
    });
  });

export default connectToSmee;
