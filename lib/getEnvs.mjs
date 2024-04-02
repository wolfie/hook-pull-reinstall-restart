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
 * @property {string} SMEE_ID
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
  assert("SMEE_ID");
  assert("GITHUB_PROJECT_SECRET");
  assert("MAIN_BRANCH_NAME");
  const { SMEE_ID, GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME } = process.env;
  // @ts-ignore
  return { SMEE_ID, GITHUB_PROJECT_SECRET, MAIN_BRANCH_NAME };
};

const onCancel = () => process.exit(130);

/**
 * @returns {Promise<Envs>}
 */
const askQuestions = async () => {
  const smeeQuestion = await prompts(
    {
      type: "select",
      message: "Do you have a Smee.io channel already?",
      name: "createNew",
      initial: process.env.SMEE_ID ? 1 : 0,
      choices: [
        {
          title: "No",
          description: "One will be created for you",
          value: true,
        },
        {
          title: "Yes",
          description: "The id will be asked of you",
          value: false,
        },
      ],
    },
    { onCancel },
  );

  /**@type {string} */
  let SMEE_ID;
  if (smeeQuestion.createNew) {
    SMEE_ID = await createSmeeChannel();
    log.info("Created Smee.io channel " + kleur.bold().yellow(SMEE_ID));
  } else {
    const answers = await prompts(
      {
        type: "text",
        name: "SMEE_ID",
        message: "Smee.io channel id",
        initial: process.env.SMEE_ID,
        validate: (value) =>
          value.length === 16 || "ID should be 16 characters long",
      },
      { onCancel },
    );
    SMEE_ID = answers.SMEE_ID;
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
        `SMEE_ID="${SMEE_ID}"`,
        `GITHUB_PROJECT_SECRET="${GITHUB_PROJECT_SECRET}"`,
        `MAIN_BRANCH_NAME="${MAIN_BRANCH_NAME}"`,
      ].join(os.EOL) + os.EOL,
      "utf-8",
    );
  }

  return {
    SMEE_ID,
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
