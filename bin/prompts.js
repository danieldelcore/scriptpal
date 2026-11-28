const chalk = require("chalk");
const { AutoComplete, Snippet, Confirm, Input } = require("enquirer");

class PromptInterrupted extends Error {}

async function runPrompt(Prompt, options) {
  const prompt = new Prompt({
    ...options,
    onRun() {
      this.once("start", () => {
        // Enquirer can pause an already-closed readline interface during cleanup.
        // Wrap only its stop listener until https://github.com/enquirer/enquirer/pull/485 ships.
        const stop = this.stop;
        this.removeListener("close", stop);
        this.once("close", () => {
          try {
            stop();
          } catch (error) {
            if (error?.code !== "ERR_USE_AFTER_CLOSE") throw error;
          }
        });
      });
    },
  });

  try {
    return await prompt.run();
  } catch (error) {
    const key = prompt.state?.keypress;
    if (error === "" && key?.ctrl && key.name === "c") {
      throw new PromptInterrupted();
    }
    throw error;
  }
}

const promptShouldRerunPrevious = async (previous) => {
  const previousCommand = `${previous.script} ${
    previous.parameters || ""
  }`.trim();

  return runPrompt(Confirm, {
    message: `Would you like to rerun the previous command?\n${chalk.greenBright(
      previousCommand
    )}`,
  });
};

const promptShouldRerunPreviousBookmark = async (command) => {
  return runPrompt(Confirm, {
    message: `Would you like to rerun the previous bookmark command?\n${chalk.greenBright(
      command
    )}`,
  });
};

const promptGetCommand = async (choices) => {
  const script = await runPrompt(AutoComplete, {
    message: "Which script would you like to run? 🤷‍♂️",
    limit: 18,
    choices,
  });

  const {
    values: { parameters },
  } = await runPrompt(Snippet, {
    message: "Would you like to add parameters?",
    required: false,
    fields: [
      {
        name: "parameters",
        message: "parameters",
      },
    ],
    template: `${script} \${parameters}`,
  });

  return {
    script,
    parameters,
  };
};

const promptGetWildcardValue = async (name) => {
  return runPrompt(Input, {
    message: `Provide value for ${chalk.greenBright(name)}`,
  });
};

const promptSelectBookmark = async (bookmarks) => {
  return runPrompt(AutoComplete, {
    message: "Which bookmark would you like to run? 🤷‍♂️",
    limit: 18,
    choices: bookmarks,
  });
};

module.exports = {
  PromptInterrupted,
  promptShouldRerunPrevious,
  promptShouldRerunPreviousBookmark,
  promptGetCommand,
  promptGetWildcardValue,
  promptSelectBookmark,
};
