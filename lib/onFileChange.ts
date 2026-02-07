import fs from 'fs';

const onFileChange = (path: string): Promise<void> =>
  new Promise((resolve) => {
    const watcher = fs.watch(path, (e) => {
      if (e !== 'change') return;
      watcher.close();
      resolve(undefined);
    });
  });

export default onFileChange;
