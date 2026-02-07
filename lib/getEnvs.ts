import prompts from 'prompts';
import { configDotenv } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import kleur from 'kleur';
import * as log from './log.ts';
import createSmeeChannel from './smee/createSmeeChannel.ts';
import getScripts from './node/getScripts.ts';

type Envs = {
  EVENT_SOURCE_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
  MAIN_BRANCH_NAME: string;
  START_SCRIPT: string;
  ONCE_SCRIPT: string | undefined;
};

const DOTENV_PATH = path.resolve(process.cwd(), '.hprrrc');
const DEFAULT_START_SCRIPT = 'start';

const assert = (envKey: string) => {
  if (!process.env[envKey]) {
    log.error(`${kleur.bold().yellow(envKey)} environment variable not set`);
    process.exit(1);
  }
};

const getOnlyEnvs = (): Envs => {
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
    EVENT_SOURCE_URL: EVENT_SOURCE_URL!,
    GITHUB_WEBHOOK_SECRET: GITHUB_WEBHOOK_SECRET!,
    MAIN_BRANCH_NAME: MAIN_BRANCH_NAME!,
    START_SCRIPT,
    ONCE_SCRIPT,
  };
};

const onCancel = () => process.exit(130);

const askQuestions = async (
  /** @deprecated */ SMEE_ID: string | undefined,
  /** @deprecated */ GITHUB_PROJECT_SECRET: string | undefined,
): Promise<Envs> => {
  const scriptChoices = await getScripts().then((scripts) =>
    Object.entries(scripts).map(
      ([name, cmd]): prompts.Choice => ({
        title: name,
        description: cmd,
      }),
    ),
  );

  let scriptQuestion: prompts.Answers<'script'> | undefined;
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
  const START_SCRIPT = scriptQuestion.script as string;

  let onceScriptQuestion: prompts.Answers<'script'> | undefined;
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
      : (onceScriptQuestion.script as string);

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

  let EVENT_SOURCE_URL: string;
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
        format: (value: string) => value.trim(),
        validate: (value: string) =>
          value.trim().length === 16
            ? 'Give the entire Smee.io URI'
            : !value.trim().toLowerCase().startsWith('http')
              ? 'Give the entire URI'
              : true,
      },
      { onCancel },
    );
    EVENT_SOURCE_URL = answers.EVENT_SOURCE_URL as string;
  }

  const { GITHUB_WEBHOOK_SECRET, MAIN_BRANCH_NAME, saveAnswers } =
    await prompts(
      [
        {
          type: 'text',
          name: 'GITHUB_WEBHOOK_SECRET',
          message: 'Github webhook secret',
          initial: GITHUB_PROJECT_SECRET || process.env.GITHUB_WEBHOOK_SECRET,
          format: (value: string) => value.trim(),
          validate: (value: string) => value.trim().length > 0,
        },
        {
          type: 'text',
          name: 'MAIN_BRANCH_NAME',
          message: 'Main branch name',
          initial: process.env.MAIN_BRANCH_NAME ?? 'master',
          format: (value: string) => value.trim(),
          validate: (value: string) => value.trim().length > 0,
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
    GITHUB_WEBHOOK_SECRET: GITHUB_WEBHOOK_SECRET as string,
    MAIN_BRANCH_NAME: MAIN_BRANCH_NAME as string,
    START_SCRIPT,
    ONCE_SCRIPT,
  };
};

const getEnvs = async (useEnvs: boolean): Promise<Envs> => {
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
