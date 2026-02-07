import kleur from 'kleur';
import * as log from './log.mjs'
import getScriptCommand from './node/getScriptCommand.mjs';
import spawn from './spawn.mjs';
import path from 'path';
import fs from 'fs'

/**
 * @param {string} path
 */
const onFileChange = (path) =>
  new Promise((resolve) => {
    const watcher = fs.watch(path, (e) => {
      if (e !== 'change') return;
      watcher.close();
      resolve(undefined);
    });
  });


/**
 * @param {boolean} verbose 
 * @param {string} onceScript
 */
const runOnceScript = (verbose, onceScript) => {
  const file = path.resolve(process.cwd(), '.hprrrc');

  if (verbose) {
    log.info(
      `Waiting for ${kleur.bold().yellow(file)} to change to run "${kleur.bold().yellow(onceScript)}"...`,
    );
  }

  onFileChange(file).then(async () => {
    if (verbose)
      log.info(`Triggering "${kleur.bold().yellow(onceScript)}" once`);

    const onceCommand = await getScriptCommand(onceScript);
    log.info(`Running "${kleur.bold().yellow(onceCommand.original)}"`);
    const onceSpawnResult = spawn(onceCommand.original, undefined, {
      shell: true,
    });
    log.info(
      `Child process running on PID ${kleur.bold().yellow(onceSpawnResult.child.pid ?? '[undefined]')}`,
    );
  });
}

export default runOnceScript