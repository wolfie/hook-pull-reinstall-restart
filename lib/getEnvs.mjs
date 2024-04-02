import prompts from "prompts";
import { configDotenv } from "dotenv";
import fs from "fs/promises";
import path from "path";
import os from "os";
import kleur from "kleur";
import * as log from "./log.mjs";
import createSmeeChannel from "./smee/createSmeeChannel.mjs";

/**
 * @typedef {object} Envs
 * @property {string} EVENT_SOURCE_URL
 * @property {string} GITHUB_PROJECT_SECRET
 * @property {string} MAIN_BRANCH_NAME
 */

const DOTENV_PATH = path.resolve(process.cwd(), ".hprrrc");

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
  assert("EVENT_SOURCE_URL");
  assert("GITHUB_PROJECT_SECRET"); // TODO
  assert("MAIN_BRANCH_NAME");
  const { EVENT_SOURCE_URL, GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME } =
    process.env;
  // @ts-ignore
  return { EVENT_SOURCE_URL, GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME };
};

const onCancel = () => process.exit(130);

/** @deprecated */
const SMEE_ID = process.env.SMEE_ID;

/**
 * @returns {Promise<Envs>}
 */
const askQuestions = async () => {
  const smeeQuestion = await prompts(
    {
      type: "select",
      message: "Do you have a Smee.io channel already?",
      name: "createNew",
      initial: SMEE_ID || process.env.EVENT_SOURCE_URL ? 1 : 0,
      choices: [
        {
          title: "No",
          description: "One will be created for you",
          value: true,
        },
        {
          title: "Yes",
          description: "The URL will be asked of you",
          value: false,
        },
      ],
    },
    { onCancel },
  );

  /**@type {string} */
  let EVENT_SOURCE_URL;
  if (smeeQuestion.createNew) {
    EVENT_SOURCE_URL = await createSmeeChannel();
    log.info(
      "Created Smee.io channel " + kleur.bold().yellow(EVENT_SOURCE_URL),
    );
  } else {
    const answers = await prompts(
      {
        type: "text",
        name: "EVENT_SOURCE_URL",
        message: "Smee.io channel URL",
        initial: SMEE_ID
          ? `https://smee.io/${SMEE_ID}`
          : process.env.EVENT_SOURCE_URL,
        validate:
          /**
           * @param {string} value
           */
          (value) =>
            value.length === 16
              ? "Give the entire Smee.io URI"
              : !value.toLowerCase().startsWith("http")
                ? "Give the entire URI"
                : true,
      },
      { onCancel },
    );
    EVENT_SOURCE_URL = answers.EVENT_SOURCE_URL;
  }

  const { GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME, saveAnswers } =
    await prompts(
      [
        {
          type: "text",
          name: "GITHUB_PROJECT_SECRET",
          message: "Github project secret",
          initial: process.env.GITHUB_PROJECT_SECRET,
          validate: (value) => value.length > 0,
        },
        {
          type: "text",
          name: "MAIN_BRANCH_NAME",
          message: "Main branch name",
          initial: process.env.MAIN_BRANCH_NAME ?? "master",
          validate: (value) => value.length > 0,
        },
        {
          type: "confirm",
          name: "saveAnswers",
          message: "Save answers?",
          initial: true,
        },
      ],
      { onCancel },
    );

  if (saveAnswers) {
    log.info("Saving answers to " + DOTENV_PATH);
    await fs.writeFile(
      DOTENV_PATH,
      [
        `EVENT_SOURCE_URL="${EVENT_SOURCE_URL}"`,
        `GITHUB_PROJECT_SECRET="${GITHUB_PROJECT_SECRET}"`,
        `MAIN_BRANCH_NAME="${MAIN_BRANCH_NAME}"`,
      ].join(os.EOL) + os.EOL,
      "utf-8",
    );
  }

  return {
    EVENT_SOURCE_URL,
    GITHUB_PROJECT_SECRET,
    MAIN_BRANCH_NAME,
  };
};

/**
 * @param {boolean} useEnvs
 * @returns {Promise<Envs>}
 */
const getEnvs = async (useEnvs) => {
  configDotenv({ path: DOTENV_PATH });
  return useEnvs ? getOnlyEnvs() : askQuestions();
};

export default getEnvs;
