import { EventSource } from 'eventsource';
import querystring from 'querystring';

/**
 * @typedef {(headers: Record<string, string | undefined>, body: string) => void} OnEvent
 */

/**
 * @param {OnEvent} onEvent
 * @returns {(msg: MessageEvent) => Promise<void>}
 */
const onMessage = (onEvent) => async (msg) => {
  const data = JSON.parse(msg.data);
  const body = JSON.stringify(data.body);
  /** @type {Record<string, string>} */
  const headers = {};
  Object.keys(data).forEach((key) => (headers[key] = data[key]));
  headers['content-length'] = Buffer.byteLength(body).toString();
  onEvent(headers, body);
};

/**
 * @typedef {Object} ConnectToEventSourceArgs
 * @property {string} eventSourceUrl
 * @property {(args: { source: string }) => void} [onConnecting]
 * @property {() => void} [onConnected]
 * @property {(error: any) => void} [onError]
 * @property {OnEvent} onEvent
 */

/**
 * @param {ConnectToEventSourceArgs} args
 * @returns {Promise<void>}
 */
const connectToEventSource = ({
  eventSourceUrl,
  onConnecting,
  onConnected,
  onError,
  onEvent,
}) =>
  new Promise((resolve, reject) => {
    const events = new EventSource(eventSourceUrl);

    if (!URL.canParse(eventSourceUrl)) {
      return reject(new Error(`${eventSourceUrl} is not a valid URL`));
    }

    onConnecting?.({ source: eventSourceUrl });

    // Reconnect immediately
    // EventSource doesn't officially have reconnectInterval but the library supports it
    /** @type {any} */ (events).reconnectInterval = 0;
    events.addEventListener('message', onMessage(onEvent));
    events.addEventListener('open', () => {
      onConnected?.();
      resolve(undefined);
    });
    events.addEventListener('error', (err) => {
      reject(err);
      onError?.(
        /** @type {any} */(err).code === 404
          ? 'Event source not found: ' + eventSourceUrl
          : err,
      );
    });
  });

export default connectToEventSource;
