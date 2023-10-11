#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const clipboardy = require("clipboardy");
const Conf = require("conf");
const chalk = require("chalk");
const { Command, Option, CommanderError } = require("commander");

const { version } = require("../package.json");
const welcome = require("./welcome");
const { getPackageJson } = require("./file-manager");
const { promptShouldRerunPrevious, promptGetCommand } = require("./prompts");
const { getPackageManager } = require("./detect-pkg-manager");

let packageJson;

try {
  packageJson = getPackageJson();

  if (!packageJson.scripts) {
    throw new Error(chalk.red('No "scripts" found in package.json'));
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}

function spawnScript(pkgManager, args) {
  const spawn = spawnSync(pkgManager, args, { stdio: "inherit" });

  if (spawn.error) {
    throw new Error(spawn.error);
  }
}

async function main(flags) {
  if (!flags.nowelcome) welcome();

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

  const pkgManager = getPackageManager();
  let args = !pkgManager === "npm" ? ["run", script] : [script];
  args = parameters ? [...args, parameters] : args;

  if (flags.clipboard) {
    await clipboardy.write(`${pkgManager} ${args.join(" ")}`);
    console.log("Copied to clipboard 👉 📋");
    return 0;
  }

  spawnScript(pkgManager, args);

  config.set(`${process.cwd()}.previous`, { script, parameters });
}

async function runLocalScript(script) {
  const pkgManager = getPackageManager();
  const args = !pkgManager === "npm" ? ["run", script] : [script];

  spawnScript(pkgManager, args);
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

// console.log(packageJson.scripts);
Object.keys(packageJson.scripts)
  .filter((script) => !["list"].includes(script))
  .forEach((script) => {
    program
      .usage("[global options] <file-paths>...")
      .command(script)
      .description(
        `Runs local script "${script}" detected in local package.json`
      )
      .action(() => runLocalScript(script));
  });

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(error));
    process.exit(1);
  }
})();
