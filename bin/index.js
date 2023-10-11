#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const { AutoComplete, Snippet, Confirm } = require("enquirer");
const clipboardy = require("clipboardy");
const meow = require("meow");
const Conf = require("conf");
const chalk = require("chalk");

const welcome = require("./welcome");
const { getPackageJson, hasFile } = require("./file-manager");

const promptShouldRerunPrevious = async (previous) => {
  const previousCommand = `${previous.script} ${
    previous.parameters || ""
  }`.trim();

  return await new Confirm({
    message: `Would you like to rerun the previous command?\n${chalk.greenBright(
      previousCommand
    )}`,
  }).run();
};

const promptGetCommand = async (choices) => {
  const script = await new AutoComplete({
    message: "Which script would you like to run? 🤷‍♂️",
    limit: 18,
    choices,
  }).run();

  const {
    values: { parameters },
  } = await new Snippet({
    message: "Would you like to add parameters?",
    required: false,
    fields: [
      {
        name: "parameters",
        message: "parameters",
      },
    ],
    template: `${script} \${parameters}`,
  }).run();

  return {
    script,
    parameters,
  };
};

async function main(input, flags) {
  if (!flags.nowelcome) welcome();

  const packageJson = getPackageJson();
  const choices = Object.keys(packageJson.scripts);

  const config = new Conf();
  const previous = config.get(`${process.cwd()}.previous`);

  let shouldRerunPrevious = false;

  if (!previous && flags.last) {
    console.log("Previous command not found, continuing...\n");
  } else if (previous && !flags.last) {
    shouldRerunPrevious = await promptShouldRerunPrevious(previous);
  } else {
    shouldRerunPrevious = true;
  }

  const { script, parameters } =
    (previous || flags.last) && shouldRerunPrevious
      ? previous
      : await promptGetCommand(choices);

  const isYarn = hasFile("yarn.lock");
  const packageManager = isYarn ? "yarn" : "npm";
  let args = !isYarn ? ["run", script] : [script];

  args = parameters ? [...args, parameters] : args;

  if (flags.clipboard) {
    await clipboardy.write(`${packageManager} ${args.join(" ")}`);
    console.log("Copied to clipboard 👉 📋");
    return 0;
  }

  const spawn = spawnSync(packageManager, args, { stdio: "inherit" });

  if (spawn.error) {
    throw new Error(spawn.error);
  }

  config.set(`${process.cwd()}.previous`, { script, parameters });
}

const cli = meow(
  `
  Usage
    $ scriptpal

  Options
    --last, -l  Run previous command
    --clipboard, -c Copy command to clipboard
    --nowelcome, -n  Omit welcome message
    --version Version number
    --help  Help me

  Examples
    $ scriptpal --nowelcome
    $ npx scriptpal
    $ scriptpal --last --preset="emoji"
`,
  {
    flags: {
      nowelcome: {
        type: "boolean",
        alias: "n",
      },
      clipboard: {
        type: "boolean",
        alias: "c",
      },
      last: {
        type: "boolean",
        alias: "l",
      },
    },
  }
);

(async () => {
  try {
    await main(cli.input[0], cli.flags);
  } catch (error) {
    console.error(chalk.red(error));
    console.log(error);
    process.exit(1);
  }
})();
