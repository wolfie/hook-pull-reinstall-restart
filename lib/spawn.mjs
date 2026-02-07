import { spawn as nodeSpawn } from 'node:child_process';

/**
 * @param {string} prefix
 * @param {Buffer} buffer
 */
const prefixWith = (prefix, buffer) =>
  buffer.toString().replace(/(.*)\n/g, `${prefix} $1\n`);

/**
 * @typedef {Object} CustomSpawnOptions
 * @property {boolean} [suppressOutput]
 */

/**
 * @typedef {import('node:child_process').SpawnOptions & CustomSpawnOptions} SpawnOptions
 */

/**
 * @param {string} processName
 * @param {string[]} [args]
 * @param {SpawnOptions} [opts]
 * @returns {{ child: import('node:child_process').ChildProcessWithoutNullStreams, promise: Promise<number> }}
 */
const spawn = (processName, args, opts) => {
  /** @type {import('node:child_process').ChildProcessWithoutNullStreams} */
  const child =
    /** @type {import('node:child_process').ChildProcessWithoutNullStreams} */ (
      nodeSpawn(processName, args ?? [], {
        ...opts,
        env: { ...process.env, ...opts?.env },
      })
    );

  if (
    typeof opts?.suppressOutput === 'undefined' ||
    opts.suppressOutput === false
  ) {
    child.stdout.on('data', (buffer) => {
      process.stdout.write(prefixWith('🔊 ', buffer));
    });
    child.stderr.on('data', (buffer) => {
      process.stderr.write(prefixWith('❗ ', buffer));
    });
  }
  child.on('error', (err) => console.error('🚨 ', err));
  return {
    child,
    promise: new Promise((resolve) => child.on('close', resolve)),
  };
};

export default spawn;
