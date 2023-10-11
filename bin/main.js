"use strict";
const clipboardy = require("clipboardy");
const Conf = require("conf");
const welcome = require("./welcome");
const { promptShouldRerunPrevious, promptGetCommand } = require("./prompts");
const { getPackageManager } = require("./detect-pkg-manager");
const { packageJson } = require(".");

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

  // spawnScript(pkgManager, args);
  config.set(`${process.cwd()}.previous`, { script, parameters });
}
exports.main = main;
