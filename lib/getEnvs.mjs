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
 * @typedef {object} Envs
 * @property {string} EVENT_SOURCE_URL
 * @property {string} GITHUB_WEBHOOK_SECRET
 * @property {string} MAIN_BRANCH_NAME
 * @property {string} START_SCRIPT
 */

const DOTENV_PATH = path.resolve(process.cwd(), '.hprrrc');
const DEFAULT_START_SCRIPT = 'start';

/**
 * @param {string} envKey
 */
const assert = (envKey) => {
  if (!process.env[envKey]) {
    log.error(`${kleur.bold().yellow(envKey)} environment variable not set`);
    process.exit(1);
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
  } = process.env;
  return {
    // @ts-ignore
    EVENT_SOURCE_URL,
    // @ts-ignore
    GITHUB_WEBHOOK_SECRET,
    // @ts-ignore
    MAIN_BRANCH_NAME,
    START_SCRIPT,
  };
};

const onCancel = () => process.exit(130);

/**
 * @param {string|undefined} SMEE_ID
 * @param {string|undefined} GITHUB_PROJECT_SECRET
 * @returns {Promise<Envs>}
 */
const askQuestions = async (
  /** @deprecated */ SMEE_ID,
  /** @deprecated */ GITHUB_PROJECT_SECRET,
) => {
  /** @type {prompts.Answers<"script">|undefined} */
  let scriptQuestion;
  const scriptChoices = await getScripts().then((scripts) =>
    Object.entries(scripts).map(
      /** @returns {import('prompts').Choice} */
      ([name, cmd]) => ({
        title: name,
        description: cmd,
      }),
    ),
  );

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
  const START_SCRIPT = scriptQuestion.script;

  const smeeQuestion = await prompts(
    {
      type: 'select',
      message: 'Do you have a Smee.io channel already?',
      name: 'createNew',
      initial: SMEE_ID || process.env.EVENT_SOURCE_URL ? 1 : 0,
      choices: [
        {
          title: 'No',
          description: 'One will be created for you',
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
  if (smeeQuestion.createNew) {
    EVENT_SOURCE_URL = await createSmeeChannel();
    log.info(
      'Created Smee.io channel ' + kleur.bold().yellow(EVENT_SOURCE_URL),
    );
  } else {
    const answers = await prompts(
      {
        type: 'text',
        name: 'EVENT_SOURCE_URL',
        message: 'Smee.io channel URL',
        initial: SMEE_ID
          ? `https://smee.io/${SMEE_ID}`
          : process.env.EVENT_SOURCE_URL,
        validate:
          /**
           * @param {string} value
           */
          (value) =>
            value.length === 16
              ? 'Give the entire Smee.io URI'
              : !value.toLowerCase().startsWith('http')
                ? 'Give the entire URI'
                : true,
      },
      { onCancel },
    );
    EVENT_SOURCE_URL = answers.EVENT_SOURCE_URL;
  }

  const { GITHUB_WEBHOOK_SECRET, MAIN_BRANCH_NAME, saveAnswers } =
    await prompts(
      [
        {
          type: 'text',
          name: 'GITHUB_WEBHOOK_SECRET',
          message: 'Github webhook secret',
          initial: GITHUB_PROJECT_SECRET || process.env.GITHUB_WEBHOOK_SECRET,
          validate: (value) => value.length > 0,
        },
        {
          type: 'text',
          name: 'MAIN_BRANCH_NAME',
          message: 'Main branch name',
          initial: process.env.MAIN_BRANCH_NAME ?? 'master',
          validate: (value) => value.length > 0,
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
      ].join(os.EOL) + os.EOL,
      'utf-8',
    );
  }

  return {
    EVENT_SOURCE_URL,
    GITHUB_WEBHOOK_SECRET,
    MAIN_BRANCH_NAME,
    START_SCRIPT,
  };
};

/**
 * @param {boolean} useEnvs
 * @returns {Promise<Envs>}
 */
const getEnvs = async (useEnvs) => {
  configDotenv({ path: DOTENV_PATH });

  /** @deprecated */
  const SMEE_ID = process.env.SMEE_ID;
  if (SMEE_ID) {
    log.error(
      `Env ${kleur.bold().yellow('SMEE_ID')} is superceded by ${kleur.bold().yellow('EVENT_SOURCE_URL')}`,
    );
  }

  /** @deprecated */
  const GITHUB_PROJECT_SECRET = process.env.GITHUB_PROJECT_SECRET;
  if (GITHUB_PROJECT_SECRET) {
    log.error(
      `Env ${kleur.bold().yellow('GITHUB_PROJECT_SECRET')} is superceded by ${kleur.bold().yellow('GITHUB_WEBHOOK_SECRET')}`,
    );
  }

  return useEnvs ? getOnlyEnvs() : askQuestions(SMEE_ID, GITHUB_PROJECT_SECRET);
};

export default getEnvs;
