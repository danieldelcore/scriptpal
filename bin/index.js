#!/usr/bin/env node
"use strict";

const { spawnSync } = require('child_process');
const { prompt, AutoComplete } = require("enquirer");
const clipboardy = require("clipboardy");
const meow = require("meow");

const welcome = require("./welcome");
const { getPackageJson, hasFile } = require("./file-manager");

async function main(input, flags) {
  if (!flags.nowelcome) welcome();

  const packageJson = await getPackageJson("package.json");
  const prompt = new AutoComplete({
    name: "flavor",
    message: "Which script would you like to run? 🤷‍♂️",
    limit: 18,
    choices: Object.keys(packageJson.scripts)
  });

  try {
    const script = await prompt.run();
    const packageManager = hasFile("yarn.lock") ? "yarn" : "npm run";

    if (flags.clipboard) {
      await clipboardy.write(`${packageManager} ${script}`);
      console.log("Copied to clipboard 👉 📋");
    } else {
      spawnSync(packageManager, [script], { stdio: "inherit" });
    }
  } catch (error) {
    if (error) {
      console.error(error, "🙅‍♂️");
      return 1;
    }
  }
}

const cli = meow(`
  Usage
    $ scriptpal

  Options
    --nowelcome, -n  Omit welcome message
    --help  Help me
    --version, -v  Version number
    --clipboard, -c Copy command to clipboard

  Examples
    $ scriptpal --nowelcome
    $ npx scriptpal
`,
  {
    flags: {
      nowelcome: {
        type: "boolean",
        alias: "n"
      },
      clipboard: {
        type: "boolean",
        alias: "c"
      }
    }
  }
);

main(cli.input[0], cli.flags);
