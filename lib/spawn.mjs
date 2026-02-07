import { spawn as nodeSpawn } from 'node:child_process';
import * as log from './log.mjs';
import createTimeout from './createTimeout.mjs';
import _treeKill from 'tree-kill';
import util from 'util';

const treeKill = util.promisify(_treeKill);

/** @typedef {(timeoutMs?:number)=>Promise<void>} KillFn  */

/**
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} child
 * @return {KillFn}
 * */
const createKillFn =
  (child) =>
    async (timeoutMs = 0) => {
      if (child.exitCode !== null)
        return log.info('child process had already exited.');

      // `null` means it's still running, otherwise no need to kill it.
      log.info('Killing child process');
      const timeout = createTimeout(timeoutMs);
      child.on('exit', timeout.cancel);

      if (child.pid) {
        await treeKill(child.pid);
      } else {
        child.kill();
      }

      const timeoutResult = await timeout.promise;
      if (timeoutMs > 0 && timeoutResult === 'timeout') {
        throw new Error(
          `Child process (PID ${child.pid}) did not die within ${timeoutMs / 1000} second(s)`,
        );
      }
    };

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
 * @returns {{ child: import('node:child_process').ChildProcessWithoutNullStreams, promise: Promise<number>,kill:KillFn }}
 */
const spawn = (processName, args, opts) => {
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
    kill: createKillFn(child),
  };
};

export default spawn;
