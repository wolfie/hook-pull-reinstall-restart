/**
 * @param {number} ms
 * @returns {{ cancel: () => void, promise: Promise<'success' | 'timeout'> }}
 */
const createTimeout = (ms) => {
  /** @type {() => void} */
  let cancel = () => {
    throw new Error('Unexpected orphan cancel');
  };
  /** @type {Promise<'success' | 'timeout'>} */
  const promise = new Promise((resolve) => {
    cancel = () => resolve('success');
    setTimeout(() => resolve('timeout'), ms);
  });
  return { cancel, promise };
};

export default createTimeout;
