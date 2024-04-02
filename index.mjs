#!/usr/bin/env node

import getEnvs from "./lib/getEnvs.mjs";
import meow from "meow";
import kleur from "kleur";
import connectToSmee from "./lib/smee/connectToSmee.mjs";
import spawn from "./lib/spawn.mjs";
import getPackageManagerCommand from "./lib/node/getPackageManagerCommand.mjs";
import sleep from "./lib/sleep.mjs";
import getStartCommand from "./lib/node/getStartCommand.mjs";
import * as log from "./lib/log.mjs";
import createIsValidBody from "./lib/github/createIsValidBody.mjs";

const args = meow(
  `
    --envs, -e
        Skip interactive prompts on startup and use environment variables instead
    --prod, -p
        Omit devDependencies during package installation`,
  {
    importMeta: import.meta,
    flags: {
      ["envs"]: { type: "boolean", shortFlag: "e", default: false },
      ["prod"]: { type: "boolean", shortFlag: "p", default: false },
    },
  },
);

if ((await spawn("git", undefined, { suppressOutput: true }).promise) !== 1) {
  log.error("There was an issue running `git`");
  process.exit(1);
}
const packageManagerCommand = await getPackageManagerCommand();
const startCommand = await getStartCommand();
const { GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME, SMEE_ID } = await getEnvs(
  args.flags.envs,
);

const isValidBody = createIsValidBody(GITHUB_PROJECT_SECRET);
await connectToSmee({
  smeeChannelId: SMEE_ID,
  onConnecting: ({ source }) =>
    log.info(`[Smee] Connecting to ${kleur.bold().yellow(source)}`),
  onConnected: () =>
    console.log(`☑️ ${kleur.bold().green("[Smee]")} Connected`),
  onError: (err) => log.error("[Smee]", err),
  onEvent: (headers, body) => {
    const signature = headers["x-hub-signature-256"];
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
    if (headers["x-github-event"] !== "push") {
      // unhandled event
      return;
    }

    const pushEvent = JSON.parse(body);
    if (pushEvent.ref == `refs/heads/${MAIN_BRANCH_NAME}`) {
      console.log(
        `🆕 [WebHook] [${new Date().toISOString()}] ` +
          `${pushEvent.commits.length} new commit(s) to ${pushEvent.repository.full_name}@${MAIN_BRANCH_NAME}`,
      );
      restart();
    }
  },
}).catch(() => {
  log.error("Smee failed");
  process.exit(1);
});

// Main loop

/** @type {ReturnType<typeof spawn>|undefined} */
let spawnResult = undefined;
const restart = async () => {
  if (spawnResult) {
    log.info("Killing child process");
    spawnResult.abortController.abort();
    log.info("Waiting 500ms");
    await sleep(500);
  }

  log.info(`Running "${kleur.bold().yellow("git pull")}"`);
  const gitPullExitCode = await spawn("git", ["pull"]).promise;
  if (gitPullExitCode !== 0) process.exit(1);

  log.info(
    `Running "${kleur.bold().yellow(packageManagerCommand + " install")}"` +
      (args.flags.prod ? ' with NODE_ENV="production"' : ""),
  );
  const options = {
    env: args.flags.prod ? { NODE_ENV: "production" } : undefined,
  };
  const installExitCode = await spawn(
    packageManagerCommand,
    ["install"],
    options,
  ).promise;
  if (installExitCode !== 0) process.exit(1);

  log.info(`Running "${kleur.bold().yellow(startCommand.original)}"`);
  spawnResult = spawn(...startCommand.spawnArgs);
  log.info(
    `Child process running on PID ${kleur.bold().yellow(spawnResult.child.pid ?? "[undefined]")}`,
  );
};

process.on("unhandledRejection", (e) => {
  console.error(e);
  spawnResult?.abortController.abort();
  process.exit(1);
});
process.on("uncaughtException", (e) => {
  console.error(e);
  spawnResult?.abortController.abort();
  process.exit(1);
});

restart();
