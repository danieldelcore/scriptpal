#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const clipboardy = require("clipboardy");
const Conf = require("conf");
const chalk = require("chalk");
const { Command } = require("commander");

const { version } = require("../package.json");
const welcome = require("./welcome");
const { getPackageJson } = require("./file-manager");
const { promptShouldRerunPrevious, promptGetCommand } = require("./prompts");
const { getPackageManager } = require("./detect-pkg-manager");

function getPackageScripts() {
  const packageJson = getPackageJson();

  if (!packageJson.scripts) {
    throw new Error(chalk.red('No "scripts" found in package.json'));
  }

  return packageJson.scripts;
}

function spawnScript(pkgManager, args) {
  const result = spawnSync(pkgManager, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

async function main(flags) {
  if (!flags.nowelcome) welcome();

  const choices = Object.keys(getPackageScripts());
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
  let args = pkgManager === "npm" ? ["run", script] : [script];
  args = parameters ? [...args, parameters] : args;

  if (flags.clipboard) {
    await clipboardy.write(`${pkgManager} ${args.join(" ")}`);
    console.log("Copied to clipboard 👉 📋");
    return 0;
  }

  config.set(`${process.cwd()}.previous`, { script, parameters });

  spawnScript(pkgManager, args);
}

async function runLocalScript(script) {
  const scripts = getPackageScripts();

  if (!scripts[script]) {
    throw new Error(
      chalk.red(`Script "${script}" not found in local package.json scripts.`),
    );
  }

  const pkgManager = getPackageManager();
  const args = pkgManager === "npm" ? ["run", script] : [script];

  spawnScript(pkgManager, args);
}

async function list() {
  const scripts = getPackageScripts();

  Object.entries(scripts).forEach(([key, value]) => {
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
  $ scriptpal start`,
  )
  .argument("[script]")
  .action(async (script, options) =>
    script ? runLocalScript(script) : main(options),
  );

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
