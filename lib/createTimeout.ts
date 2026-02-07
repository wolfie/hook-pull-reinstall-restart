const createTimeout = (ms: number) => {
  let cancel: () => void = () => {
    throw new Error('Unexpected orphan cancel');
  };
  const promise: Promise<'success' | 'timeout'> = new Promise((resolve) => {
    cancel = () => resolve('success');
    setTimeout(() => resolve('timeout'), ms);
  });
  return { cancel, promise };
};

export default createTimeout;
