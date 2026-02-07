import { EventSource } from 'eventsource';
import querystring from 'querystring';

type OnEvent = (
  headers: Record<string, string | undefined>,
  body: string,
) => void;

const onMessage = (onEvent: OnEvent) => async (msg: MessageEvent) => {
  const data = JSON.parse(msg.data);
  const body = JSON.stringify(data.body);
  const headers: Record<string, string> = {};
  Object.keys(data).forEach((key) => (headers[key] = data[key]));
  headers['content-length'] = Buffer.byteLength(body).toString();
  onEvent(headers, body);
};

type ConnectToSmeeArgs = {
  eventSourceUrl: string;
  onConnecting?: (args: { source: string }) => void;
  onConnected?: () => void;
  onError?: (error: any) => void;
  onEvent: OnEvent;
};

const connectToSmee = ({
  eventSourceUrl,
  onConnecting,
  onConnected,
  onError,
  onEvent,
}: ConnectToSmeeArgs) =>
  new Promise<void>((resolve, reject) => {
    const source = eventSourceUrl.startsWith('https://smee.io')
      ? eventSourceUrl
      : `https://smee.io/${querystring.escape(eventSourceUrl)}`;
    const events = new EventSource(source);

    if (!URL.canParse(source)) {
      return reject(new Error(`${eventSourceUrl} is not a valid URL`));
    }

    onConnecting?.({ source });

    // Reconnect immediately
    // EventSource doesn't officially have reconnectInterval but the library supports it
    (events as any).reconnectInterval = 0;
    events.addEventListener('message', onMessage(onEvent));
    events.addEventListener('open', () => {
      onConnected?.();
      resolve(undefined);
    });
    events.addEventListener('error', (err: any) => {
      reject(err);
      onError?.(err.code === 404 ? 'No such channel: ' + source : err);
    });
  });

export default connectToSmee;
