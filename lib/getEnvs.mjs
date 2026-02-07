import prompts from 'prompts';
import { configDotenv } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import kleur from 'kleur';
import * as log from './log.mjs';
import createSmeeChannel from './smee/createSmeeChannel.mjs';
import getScripts from './node/getScripts.mjs';

/**
 * @typedef {Object} Envs
 * @property {string} EVENT_SOURCE_URL
 * @property {string} GITHUB_WEBHOOK_SECRET
 * @property {string} MAIN_BRANCH_NAME
 * @property {string} START_SCRIPT
 * @property {string | undefined} ONCE_SCRIPT
 */

const DOTENV_PATH = path.resolve(process.cwd(), '.hprrrc');
const DEFAULT_START_SCRIPT = 'start';

/**
 * @param {string} envKey
 * @throws {Error}
 */
const assert = (envKey) => {
  if (!process.env[envKey]) {
    throw new Error(`${envKey} environment variable not set`);
  }
};

/**
 * @returns {Envs}
 */
const getOnlyEnvs = () => {
  assert('EVENT_SOURCE_URL');
  assert('GITHUB_WEBHOOK_SECRET');
  assert('MAIN_BRANCH_NAME');
  const {
    EVENT_SOURCE_URL,
    GITHUB_WEBHOOK_SECRET,
    MAIN_BRANCH_NAME,
    START_SCRIPT = DEFAULT_START_SCRIPT,
    ONCE_SCRIPT,
  } = process.env;
  return {
    EVENT_SOURCE_URL: /** @type {string} */ (EVENT_SOURCE_URL),
    GITHUB_WEBHOOK_SECRET: /** @type {string} */ (GITHUB_WEBHOOK_SECRET),
    MAIN_BRANCH_NAME: /** @type {string} */ (MAIN_BRANCH_NAME),
    START_SCRIPT,
    ONCE_SCRIPT,
  };
};

const onCancel = () => process.exit(130);

/**
 * @returns {Promise<Envs>}
 */
const askQuestions = async () => {
  const scriptChoices = await getScripts().then((scripts) =>
    Object.entries(scripts).map(
      ([name, cmd]) =>
        /** @type {prompts.Choice} */ ({
          title: name,
          description: cmd,
        }),
    ),
  );

  /** @type {prompts.Answers<'script'> | undefined} */
  let scriptQuestion;
  // for some reason, `validate` doesn't work for autocomplete...
  while (
    !scriptQuestion ||
    !scriptChoices.some(({ title }) => title === scriptQuestion?.script)
  )
    scriptQuestion = await prompts(
      {
        type: 'autocomplete',
        name: 'script',
        message: 'Start script',
        initial: process.env.START_SCRIPT || 'start',
        choices: scriptChoices,
      },
      { onCancel },
    );
  const START_SCRIPT = /** @type {string} */ (scriptQuestion.script);

  /** @type {prompts.Answers<'script'> | undefined} */
  let onceScriptQuestion;
  const NONE = Symbol('none');
  // for some reason, `validate` doesn't work for autocomplete...
  while (
    !onceScriptQuestion ||
    (onceScriptQuestion.script !== NONE &&
      !scriptChoices.some(({ title }) => title === onceScriptQuestion?.script))
  )
    onceScriptQuestion = await prompts(
      {
        type: 'autocomplete',
        name: 'script',
        message: 'Script to run once (touch .hprrrc to trigger)',
        initial: process.env.ONCE_SCRIPT ?? 0,
        choices: [
          { title: kleur.italic('none'), value: NONE },
          ...scriptChoices,
        ],
      },
      { onCancel },
    );
  const ONCE_SCRIPT =
    onceScriptQuestion.script === NONE
      ? undefined
      : /** @type {string} */ (onceScriptQuestion.script);

  const eventSourceQuestion = await prompts(
    {
      type: 'select',
      message: 'Do you have an event source URL already?',
      name: 'createNew',
      initial: process.env.EVENT_SOURCE_URL ? 1 : 0,
      choices: [
        {
          title: 'No',
          description: 'One will be created for you (via smee.io)',
          value: true,
        },
        {
          title: 'Yes',
          description: 'The URL will be asked of you',
          value: false,
        },
      ],
    },
    { onCancel },
  );

  /** @type {string} */
  let EVENT_SOURCE_URL;
  if (eventSourceQuestion.createNew) {
    EVENT_SOURCE_URL = await createSmeeChannel();
    log.info('Created event source ' + kleur.bold().yellow(EVENT_SOURCE_URL));
  } else {
    const answers = await prompts(
      {
        type: 'text',
        name: 'EVENT_SOURCE_URL',
        message: 'Event source URL',
        initial: process.env.EVENT_SOURCE_URL,
        format: (/** @type {string} */ value) => value.trim(),
        validate: (/** @type {string} */ value) =>
          value.trim().length === 16
            ? 'Give the entire event source URL'
            : !value.trim().toLowerCase().startsWith('http')
              ? 'Give the entire URL'
              : true,
      },
      { onCancel },
    );
    EVENT_SOURCE_URL = /** @type {string} */ (answers.EVENT_SOURCE_URL);
  }

  const { GITHUB_WEBHOOK_SECRET, MAIN_BRANCH_NAME, saveAnswers } =
    await prompts(
      [
        {
          type: 'text',
          name: 'GITHUB_WEBHOOK_SECRET',
          message: 'Github webhook secret',
          initial: process.env.GITHUB_WEBHOOK_SECRET,
          format: (/** @type {string} */ value) => value.trim(),
          validate: (/** @type {string} */ value) => value.trim().length > 0,
        },
        {
          type: 'text',
          name: 'MAIN_BRANCH_NAME',
          message: 'Main branch name',
          initial: process.env.MAIN_BRANCH_NAME ?? 'master',
          format: (/** @type {string} */ value) => value.trim(),
          validate: (/** @type {string} */ value) => value.trim().length > 0,
        },
        {
          type: 'confirm',
          name: 'saveAnswers',
          message: 'Save answers?',
          initial: true,
        },
      ],
      { onCancel },
    );

  if (saveAnswers) {
    log.info('Saving answers to ' + DOTENV_PATH);
    await fs.writeFile(
      DOTENV_PATH,
      [
        `EVENT_SOURCE_URL="${EVENT_SOURCE_URL}"`,
        `GITHUB_WEBHOOK_SECRET="${GITHUB_WEBHOOK_SECRET}"`,
        `MAIN_BRANCH_NAME="${MAIN_BRANCH_NAME}"`,
        `START_SCRIPT="${START_SCRIPT}"`,
        ONCE_SCRIPT && `ONCE_SCRIPT="${ONCE_SCRIPT}"`,
      ]
        .filter(Boolean)
        .join(os.EOL) + os.EOL,
      'utf-8',
    );
  }

  return {
    EVENT_SOURCE_URL,
    GITHUB_WEBHOOK_SECRET: /** @type {string} */ (GITHUB_WEBHOOK_SECRET),
    MAIN_BRANCH_NAME: /** @type {string} */ (MAIN_BRANCH_NAME),
    START_SCRIPT,
    ONCE_SCRIPT,
  };
};

/**
 * @param {boolean} forceInteractive
 * @returns {Promise<Envs>}
 */
const getEnvs = async (forceInteractive) => {
  configDotenv({ path: DOTENV_PATH, quiet: true });

  if (forceInteractive) {
    return askQuestions();
  }

  try {
    return getOnlyEnvs();
  } catch (error) {
    log.info('Falling back to interactive prompts');
    return askQuestions();
  }
};

export default getEnvs;
