import { spawn as nodeSpawn } from 'node:child_process';
import type {
  SpawnOptions as NodeSpawnOptions,
  ChildProcessWithoutNullStreams,
} from 'node:child_process';

const prefixWith = (prefix: string, buffer: Buffer) =>
  buffer.toString().replace(/(.*)\n/g, `${prefix} $1\n`);

type CustomSpawnOptions = {
  suppressOutput?: boolean;
};

type SpawnOptions = CustomSpawnOptions & NodeSpawnOptions;

const spawn = (processName: string, args?: string[], opts?: SpawnOptions) => {
  const child: ChildProcessWithoutNullStreams = nodeSpawn(
    processName,
    args ?? [],
    {
      ...opts,
      env: { ...process.env, ...opts?.env },
    },
  ) as ChildProcessWithoutNullStreams;

  if (
    typeof opts?.suppressOutput === 'undefined' ||
    opts.suppressOutput === false
  ) {
    child.stdout.on('data', (buffer: Buffer) => {
      process.stdout.write(prefixWith('🔊 ', buffer));
    });
    child.stderr.on('data', (buffer: Buffer) => {
      process.stderr.write(prefixWith('❗ ', buffer));
    });
  }
  child.on('error', (err) => console.error('🚨 ', err));
  return {
    child,
    promise: new Promise<number>((resolve) => child.on('close', resolve)),
  };
};

export default spawn;
