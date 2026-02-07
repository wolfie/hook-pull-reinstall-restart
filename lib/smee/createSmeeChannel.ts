import * as log from '../log.ts';

const createSmeeChannel = async (): Promise<string> => {
  const response = await fetch('https://smee.io/new', {
    method: 'HEAD',
    redirect: 'manual',
  });
  const address = response.headers.get('location');
  if (!address) {
    log.error('Failed to create a new event source channel');
    process.exit(1);
  }
  return address;
};

export default createSmeeChannel;
