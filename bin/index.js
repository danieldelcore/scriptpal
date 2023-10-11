#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const { AutoComplete, Snippet, Confirm } = require("enquirer");
const clipboardy = require("clipboardy");
const Conf = require("conf");
const chalk = require("chalk");
const { Command, Option, CommanderError } = require("commander");

const { version } = require("../package.json");
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

async function main(flags) {
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

async function list() {
  const packageJson = getPackageJson();
  Object.entries(packageJson.scripts).forEach(([key, value]) => {
    console.log(`· ${chalk.greenBright(key)}: ${value}`);
  });
}

const program = new Command();

program
  .enablePositionalOptions()
  .name("scriptpal")
  .version(version, "-v, --version")
  .option("-l, --last", "Run previous command")
  .option("-c, --clipboard", "Copy command to clipboard")
  .option("-n, --nowelcome", "Omit welcome message")
  .addHelpText(
    "after",
    `
Examples
  $ scriptpal --last
  $ scriptpal --clipboard
  $ scriptpal --last --clipboard
  $ scriptpal -lcn
  $ scriptpal --nowelcome
  $ npx scriptpal
  $ scriptpal --last --preset="emoji"`
  )
  .action(async (options) => await main(options));

program
  .command("list")
  .description("List available scripts from package.json")
  .action(() => list());

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(error));
    process.exit(1);
  }
})();
