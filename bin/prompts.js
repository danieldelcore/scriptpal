const chalk = require("chalk");
const { AutoComplete, Snippet, Confirm, Input } = require("enquirer");

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

const promptGetWildcardValue = async (name) => {
  return await new Input({
    message: `Provide value for ${chalk.greenBright(name)}`,
  }).run();
};

const promptSelectBookmark = async (bookmarks) => {
  return await new AutoComplete({
    message: "Which bookmark would you like to run? 🤷‍♂️",
    limit: 18,
    choices: bookmarks,
  }).run();
};

module.exports = {
  promptShouldRerunPrevious,
  promptGetCommand,
  promptGetWildcardValue,
  promptSelectBookmark,
};
