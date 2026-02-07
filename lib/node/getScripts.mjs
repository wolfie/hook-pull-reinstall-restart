import fs from 'fs/promises';
import path from 'path';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');

/**
 * @returns {Promise<{ [script: string]: string }>}
 */
const getScripts = () =>
  fs
    .readFile(PACKAGE_JSON_PATH, 'utf-8')
    .then((contents) => JSON.parse(contents).scripts);

export default getScripts;
