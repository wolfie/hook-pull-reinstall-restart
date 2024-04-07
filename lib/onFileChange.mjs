import fs from 'fs';

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
const onFileChange = (path) =>
  new Promise((resolve) => {
    const watcher = fs.watch(path, (e) => {
      if (e !== 'change') return;
      watcher.close();
      resolve(undefined);
    });
  });

export default onFileChange;
