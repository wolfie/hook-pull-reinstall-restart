import path from 'path';
import * as log from '../log.ts';
import getScripts from './getScripts.ts';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const QUOTE_SPLIT_REGEX = /[^\s"]+|"([^"]*)"/gi;

const splitWithQuotes = (str: string): string[] => {
  const results: string[] = [];
  let match: RegExpExecArray | null = null;
  do {
    match = QUOTE_SPLIT_REGEX.exec(str);
    if (match != null) {
      results.push(match[1] ? match[1] : match[0]);
    }
  } while (match != null);
  return results;
};

type ScriptCommand = {
  original: string;
  spawnArgs: [processName: string, args: string[]];
};

const getScriptCommand = (scriptName: string): Promise<ScriptCommand> =>
  getScripts()
    .then((scripts) => {
      if (!(scriptName in scripts)) {
        throw new Error(`No '${scriptName}' script in package.json`);
      }
      const cmd = scripts[scriptName];
      const [processName, ...args] = splitWithQuotes(cmd);
      return {
        original: cmd,
        spawnArgs: [processName, args] as [string, string[]],
      };
    })
    .catch((e) => {
      if (typeof e === 'object' && e && 'code' in e && e.code === 'ENOENT') {
        log.error('Could not find ' + PACKAGE_JSON_PATH);
        process.exit(1);
      } else {
        throw e;
      }
    });

export default getScriptCommand;
