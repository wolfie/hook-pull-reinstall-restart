#!/usr/bin/env node

import getEnvs from './lib/getEnvs.mjs';
import meow from 'meow';
import kleur from 'kleur';
import connectToSmee from './lib/smee/connectToSmee.mjs';
import spawn from './lib/spawn.mjs';
import getPackageManagerCommand from './lib/node/getPackageManagerCommand.mjs';
import createTimeout from './lib/createTimeout.mjs';
import getScriptCommand from './lib/node/getScriptCommand.mjs';
import * as log from './lib/log.mjs';
import createIsValidBody from './lib/github/createIsValidBody.mjs';
import _treeKill from 'tree-kill';
import util from 'util';

// Trying out whether a shell is a huge overhead.
const USE_SHELL = true;

const treeKill = util.promisify(_treeKill);

const args = meow(
  `
    --envs, -e
        Skip interactive prompts on startup and use environment variables instead
    --prod, -p
        Omit devDependencies during package installation`,
  {
    importMeta: import.meta,
    flags: {
      envs: { type: 'boolean', shortFlag: 'e', default: false },
      prod: { type: 'boolean', shortFlag: 'p', default: false },
    },
  },
);

if ((await spawn('git', undefined, { suppressOutput: true }).promise) !== 1) {
  log.error('There was an issue running `git`');
  process.exit(1);
}
const packageManagerCommand = await getPackageManagerCommand();
const {
  GITHUB_WEBHOOK_SECRET,
  MAIN_BRANCH_NAME,
  EVENT_SOURCE_URL,
  START_SCRIPT,
} = await getEnvs(args.flags.envs);

const isValidBody = createIsValidBody(GITHUB_WEBHOOK_SECRET);
await connectToSmee({
  eventSourceUrl: EVENT_SOURCE_URL,
  onConnecting: ({ source }) =>
    log.info(`[Smee] Connecting to ${kleur.bold().yellow(source)}`),
  onConnected: () =>
    console.log(`✅ ${kleur.bold().green('[Smee]')} Connected`),
  onError: (err) => log.error('[Smee]', err),
  onEvent: (headers, body) => {
    const signature = headers['x-hub-signature-256'];
    if (!signature) {
      return log.error(
        `[WebHook] [${new Date().toISOString()}] Received payload without a secret`,
      );
    }
    if (!isValidBody(signature, body)) {
      return log.error(
        `[WebHook] [${new Date().toISOString()}] Received payload with incorrect secret`,
      );
    }
    if (headers['x-github-event'] !== 'push') {
      // unhandled event
      return;
    }

    const pushEvent = JSON.parse(body);
    if (pushEvent.ref === `refs/heads/${MAIN_BRANCH_NAME}`) {
      console.log(
        `🆕 [WebHook] [${new Date().toISOString()}] ` +
          `${pushEvent.commits.length} new commit(s) to ${pushEvent.repository.full_name}@${MAIN_BRANCH_NAME}`,
      );
      restart();
    }
  },
}).catch(() => {
  log.error('Smee failed');
  process.exit(1);
});

// Main loop

const KILL_TIMEOUT = 1000;

/** @type {ReturnType<typeof spawn>|undefined} */
let spawnResult;
const restart = async () => {
  if (spawnResult) {
    log.info('Killing child process');
    const timeout = createTimeout(1000);
    spawnResult.child.on('exit', timeout.cancel);
    if (spawnResult.child.pid) {
      await treeKill(spawnResult.child.pid);
    } else {
      spawnResult.child.kill();
    }
    const timeoutResult = await timeout.timeout;
    if (timeoutResult === 'timeout') {
      throw new Error(
        `Child process (PID ${spawnResult.child.pid}) did not die within ${KILL_TIMEOUT / 1000} second(s)`,
      );
    }
  }

  log.info(`Running "${kleur.bold().yellow('git pull')}"`);
  const gitPullExitCode = await spawn('git', ['pull']).promise;
  if (gitPullExitCode !== 0) process.exit(1);

  log.info(
    `Running "${kleur.bold().yellow(packageManagerCommand + ' install')}"` +
      (args.flags.prod ? ' with NODE_ENV="production"' : ''),
  );
  const options = {
    env: args.flags.prod ? { NODE_ENV: 'production' } : undefined,
  };
  const installExitCode = await spawn(
    packageManagerCommand,
    ['install'],
    options,
  ).promise;
  if (installExitCode !== 0) process.exit(1);

  const startCommand = await getScriptCommand(START_SCRIPT);
  log.info(`Running "${kleur.bold().yellow(startCommand.original)}"`);
  spawnResult = USE_SHELL
    ? spawn(startCommand.original, undefined, { shell: true })
    : spawn(...startCommand.spawnArgs);
  log.info(
    `Child process running on PID ${kleur.bold().yellow(spawnResult.child.pid ?? '[undefined]')}`,
  );
};

/**
 * @param {any} e
 */
const handleUnhandled = async (e) => {
  console.error(e);
  if (spawnResult?.child.pid) {
    await treeKill(spawnResult.child.pid);
  } else {
    spawnResult?.child.kill();
  }
  process.exit(1);
};
process.on('unhandledRejection', handleUnhandled);
process.on('uncaughtException', handleUnhandled);

restart();
