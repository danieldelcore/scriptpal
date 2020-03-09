#!/usr/bin/env node
"use strict";

const { spawnSync } = require('child_process');
const { AutoComplete, Snippet } = require("enquirer");
const clipboardy = require("clipboardy");
const meow = require("meow");
const Conf = require('conf');
const welcome = require("./welcome");
const { getPackageJson, hasFile } = require("./file-manager");

async function main(input, flags) {
  if (!flags.nowelcome) welcome();

  const packageJson = getPackageJson();
  const choices = Object.keys(packageJson.scripts);
  const config = new Conf();
  const previous = config.get('previous');

  let initial = (previous && choices[previous.index] === previous.command)
    ? previous.index
    : 0;

  const script = await new AutoComplete({
    name: "scripts",
    message: "Which script would you like to run? 🤷‍♂️",
    limit: 18,
    // Choices array is modified
    choices: [...choices],
    initial,
  }).run();

  const { values: { parameters } } = await new Snippet({
    name: 'parameters',
    message: 'Would you like to add parameters?',
    required: false,
    fields: [{
      name: 'parameters',
      message: 'parameters'
    }],
    template: `${script} \${parameters}`
  }).run();

  const scriptIndex = choices.indexOf(script);
  const isYarn = hasFile("yarn.lock");
  const packageManager = isYarn ? "yarn" : "npm";
  let args = !isYarn ? ['run', script] : [script];

  args = parameters ? [...args, parameters] : args;

  if (flags.clipboard) {
    await clipboardy.write(`${packageManager} ${args.join(' ')}`);
    console.log("Copied to clipboard 👉 📋");
  } else {
    const spawn = spawnSync(packageManager, args, { stdio: "inherit" });

    if (spawn.error) {
      console.error(spawn.error);
      return 1;
    }
  }

  config.set('previous', {
    command: script,
    parameters,
    index: scriptIndex,
  });
}

const cli = meow(`
  Usage
    $ scriptpal

  Options
    --nowelcome, -n  Omit welcome message
    --help  Help me
    --last, -l  Run previous command
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
