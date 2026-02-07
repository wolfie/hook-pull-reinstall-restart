#!/usr/bin/env node

import getEnvs from './lib/getEnvs.mjs';
import meow from 'meow';
import kleur from 'kleur';
import connectToSmee from './lib/smee/connectToEventSource.mjs';
import spawn from './lib/spawn.mjs';
import getPackageManagerCommand from './lib/node/getPackageManagerCommand.mjs';
import getScriptCommand from './lib/node/getScriptCommand.mjs';
import * as log from './lib/log.mjs';
import createWebhookHandler from './lib/github/createWebhookHandler.mjs';
import onFileChange from './lib/onFileChange.mjs';
import path from 'path';

const args = meow(
  `
    --interactive, -i
        Force interactive prompts on startup (default: use .hprrrc or environment variables)
    --dev, -d
        Include devDependencies during package installation (default: production mode)
    --verbose, -v
        Increase logging`,
  {
    importMeta: import.meta,
    flags: {
      interactive: { type: 'boolean', shortFlag: 'i', default: false },
      dev: { type: 'boolean', shortFlag: 'd', default: false },
      verbose: { type: 'boolean', shortFlag: 'v', default: false },
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
  ONCE_SCRIPT,
} = await getEnvs(args.flags.interactive);

/** @type {ReturnType<typeof spawn> | undefined} */
let spawnResult;

const KILL_TIMEOUT = 1000;
const restart = async () => {
  await spawnResult?.kill(KILL_TIMEOUT);

  log.info(`Running "${kleur.bold().yellow('git pull')}"`);
  const gitPullExitCode = await spawn('git', ['pull']).promise;
  if (gitPullExitCode !== 0) process.exit(1);

  log.info(
    `Running "${kleur.bold().yellow(packageManagerCommand + ' install')}"` +
    (!args.flags.dev ? ' with NODE_ENV="production"' : ''),
  );
  const options = {
    env: !args.flags.dev
      ? { NODE_ENV: /** @type {const} */ ('production') }
      : undefined,
  };
  const installExitCode = await spawn(
    packageManagerCommand,
    ['install'],
    options,
  ).promise;
  if (installExitCode !== 0) process.exit(1);

  const startCommand = await getScriptCommand(START_SCRIPT);
  log.info(`Running "${kleur.bold().yellow(startCommand.original)}"`);
  spawnResult = spawn(startCommand.original, undefined, { shell: true });
  log.info(
    `Child process running on PID ${kleur.bold().yellow(spawnResult.child.pid ?? '[undefined]')}`,
  );
};

await connectToSmee({
  eventSourceUrl: EVENT_SOURCE_URL,
  onConnecting: ({ source }) =>
    log.info(`[Event Source] Connecting to ${kleur.bold().yellow(source)}`),
  onConnected: () =>
    console.log(`✅ ${kleur.bold().green('[Event Source]')} Connected`),
  onError: (err) => log.error('[Event Source]', err),
  onEvent: createWebhookHandler({
    githubWebhookSecret: GITHUB_WEBHOOK_SECRET,
    mainBranchName: MAIN_BRANCH_NAME,
    verbose: args.flags.verbose,
    onPush: restart,
  }),
}).catch(() => {
  log.error('Event source connection failed');
  process.exit(1);
});

// Main loop

/** @type {NodeJS.UncaughtExceptionListener & NodeJS.UnhandledRejectionListener} */
const handleUnhandled = async (e) => {
  console.error(e);
  spawnResult?.kill();
  process.exit(1);
};
process.on('unhandledRejection', handleUnhandled);
process.on('uncaughtException', handleUnhandled);

if (ONCE_SCRIPT) {
  const file = path.resolve(process.cwd(), '.hprrrc');
  if (args.flags.verbose)
    log.info(
      `Waiting for ${kleur.bold().yellow(file)} to change to run "${kleur.bold().yellow(ONCE_SCRIPT)}"...`,
    );
  onFileChange(file).then(async () => {
    if (args.flags.verbose)
      log.info(`Triggering "${kleur.bold().yellow(ONCE_SCRIPT)}" once`);

    const onceCommand = await getScriptCommand(ONCE_SCRIPT);
    log.info(`Running "${kleur.bold().yellow(onceCommand.original)}"`);
    const onceSpawnResult = spawn(onceCommand.original, undefined, {
      shell: true,
    });
    log.info(
      `Child process running on PID ${kleur.bold().yellow(onceSpawnResult.child.pid ?? '[undefined]')}`,
    );
  });
}

restart();
