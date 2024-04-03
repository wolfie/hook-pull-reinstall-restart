import path from 'path';
import * as log from '../log.mjs';
import getScripts from './getScripts.mjs';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const QUOTE_SPLIT_REGEX = /[^\s"]+|"([^"]*)"/gi;

/**
 * @param {string} str
 */
const splitWithQuotes = (str) => {
  /** @type {string[]} */
  const results = [];
  /** @type {RegExpExecArray | null} */
  let match = null;
  do {
    match = QUOTE_SPLIT_REGEX.exec(str);
    if (match != null) {
      results.push(match[1] ? match[1] : match[0]);
    }
  } while (match != null);
  return results;
};

/**
 * @param {string} scriptName
 * @returns {Promise<{original:string,spawnArgs:[processName:string,args:string[]]}>}
 */
const getScriptCommand = (scriptName) =>
  getScripts()
    .then((scripts) => {
      if (!(scriptName in scripts)) {
        throw new Error(`No '${scriptName}' script in package.json`);
      }
      const cmd = scripts[scriptName];
      const [processName, ...args] = splitWithQuotes(cmd);
      return {
        original: cmd,
        spawnArgs: [processName, args],
      };
    })
    .catch((e) => {
      if (typeof e === 'object' && e && 'code' in e && e.code === 'ENOENT') {
        log.error('Could not find ' + PACKAGE_JSON_PATH);
        process.exit(1);
      } else {
        throw e;
      }

      /** @type {any} -- typecheck gets confused, so this makes it happy */
      const a = null;
      return a;
    });

export default getScriptCommand;
