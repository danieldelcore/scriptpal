#!/usr/bin/env node
"use strict";

const { prompt, AutoComplete } = require("enquirer");
const clipboardy = require("clipboardy");
const meow = require("meow");

const welcome = require("./welcome");
const { getPackageJson, hasFile } = require("./file-manager");

async function main(input, flags) {
  if (!flags.nowelcome) welcome();

  try {
    const packageJson = await getPackageJson("package.json");

    const prompt = new AutoComplete({
      name: "flavor",
      message: "Which script would you like to run? 🤷‍♂️",
      limit: 18,
      choices: Object.keys(packageJson.scripts)
    });

    const script = await prompt.run();
    const packageManager = hasFile("yarn.lock") ? "yarn" : "npm run";
    const command = `${packageManager} ${script}`;

    await clipboardy.write(command);

    console.log("Copied to clipboard 👉 📋");
  } catch (error) {
    if (error) {
      console.error(error, "🙅‍♂️");
      return 1;
    }

    return 0;
  }
}

const cli = meow(
  `
  Usage
    $ scriptpal

  Options
    --nowelcome, -n  Omit welcome message
    --help  Help me
    --version, -v  Version number

  Examples
    $ scriptpal --nowelcome
    $ npx scriptpal
`,
  {
    flags: {
      nowelcome: {
        type: "boolean",
        alias: "n"
      }
    }
  }
);

main(cli.input[0], cli.flags);
