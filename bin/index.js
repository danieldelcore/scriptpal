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
const {
  PromptInterrupted,
  promptShouldRerunPrevious,
  promptShouldRerunPreviousBookmark,
  promptGetCommand,
  promptGetWildcardValue,
  promptSelectBookmark,
} = require("./prompts");
const { getPackageManager } = require("./detect-pkg-manager");
const {
  extractWildcardDescriptors,
  getUniqueWildcardNames,
  parseWildcardArgs,
  resolveWildcardTemplate,
  resolveWildcardArguments,
} = require("./wildcards");
const {
  createBookmark,
  formatBookmark,
  sortBookmarksByName,
} = require("./bookmarks");

const BOOKMARKS_KEY = "bookmarks";
const BOOKMARK_PREVIOUS_KEY = "bookmark.previous";

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

function spawnShellCommand(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function getConfig() {
  return new Conf();
}

function getBookmarks(config = getConfig()) {
  return config.get(BOOKMARKS_KEY, {});
}

function getBookmark(name, config = getConfig()) {
  return getBookmarks(config)[name];
}

function getPreviousBookmark(config = getConfig()) {
  return config.get(BOOKMARK_PREVIOUS_KEY);
}

function setPreviousBookmark(command, config = getConfig()) {
  config.set(BOOKMARK_PREVIOUS_KEY, { command });
}

function setBookmark(name, command, config = getConfig()) {
  const bookmarks = getBookmarks(config);
  bookmarks[name] = command;
  config.set(BOOKMARKS_KEY, bookmarks);
}

function removeBookmark(name, config = getConfig()) {
  const bookmarks = getBookmarks(config);

  if (!bookmarks[name]) {
    throw new Error(chalk.red(`Bookmark "${name}" not found.`));
  }

  delete bookmarks[name];
  config.set(BOOKMARKS_KEY, bookmarks);
  console.log(`Removed bookmark "${chalk.greenBright(name)}".`);
}

async function resolveWildcards(command, wildcardPairs = []) {
  const isExec = typeof command !== "string";
  const descriptors = isExec
    ? command.args.flatMap(extractWildcardDescriptors)
    : extractWildcardDescriptors(command);
  const wildcardNames = getUniqueWildcardNames(descriptors);

  if (wildcardNames.length === 0) {
    return command;
  }

  const values = parseWildcardArgs(wildcardPairs);

  for (const wildcardName of wildcardNames) {
    if (!Object.prototype.hasOwnProperty.call(values, wildcardName)) {
      Object.defineProperty(values, wildcardName, {
        value: await promptGetWildcardValue(wildcardName),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }

  return isExec
    ? { ...command, args: resolveWildcardArguments(command.args, values) }
    : resolveWildcardTemplate(command, values);
}

async function main(flags) {
  if (!flags.nowelcome) welcome();

  const choices = Object.keys(getPackageScripts());
  const config = getConfig();
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

  // Persists previous command
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

async function listBookmarks() {
  const bookmarks = getBookmarks();
  const entries = sortBookmarksByName(Object.entries(bookmarks));

  if (entries.length === 0) {
    console.log("No bookmarks saved yet.");
    return;
  }

  entries.forEach(([name, command]) => {
    console.log(`· ${chalk.greenBright(name)}: ${formatBookmark(command)}`);
  });
}

async function addBookmark(name, commandParts, options = {}) {
  const command = createBookmark(commandParts, options);

  if (getBookmark(name)) {
    throw new Error(
      chalk.red(`Bookmark "${name}" already exists. Use edit to update it.`),
    );
  }

  setBookmark(name, command);
  console.log(`Saved bookmark "${chalk.greenBright(name)}".`);
}

async function editBookmark(name, commandParts, options = {}) {
  const existing = getBookmark(name);
  const mode = !options.exec && !options.shell && existing?.mode === "exec"
    ? { exec: true }
    : options;
  const command = createBookmark(commandParts, mode);

  if (!existing) {
    throw new Error(
      chalk.red(`Bookmark "${name}" not found. Use add to create it first.`),
    );
  }

  setBookmark(name, command);
  console.log(`Updated bookmark "${chalk.greenBright(name)}".`);
}

function executeBookmark(command, options = {}) {
  if (options.preview) {
    console.log(
      typeof command === "string" ? `[shell] ${command}` : formatBookmark(command),
    );
    return;
  }
  if (typeof command === "string") {
    spawnShellCommand(command);
  } else {
    const result = spawnSync(command.executable, command.args, {
      stdio: "inherit",
      shell: false,
    });
    if (result.error) throw result.error;
    if (typeof result.status === "number" && result.status !== 0) {
      process.exit(result.status);
    }
  }
}

async function runBookmark(name, wildcardPairs = [], options = {}) {
  const command = getBookmark(name);

  if (!command) {
    throw new Error(chalk.red(`Bookmark "${name}" not found.`));
  }

  const resolvedCommand = await resolveWildcards(command, wildcardPairs);
  if (!options.preview) setPreviousBookmark(resolvedCommand);
  executeBookmark(resolvedCommand, options);
}

async function runPreviousBookmark(options = {}) {
  const previousBookmark = getPreviousBookmark();

  if (!previousBookmark) {
    console.log("Previous bookmark command not found.");
    return;
  }

  executeBookmark(previousBookmark.command, options);
}

async function pickAndRunBookmark(options = {}) {
  if (options.last) {
    await runPreviousBookmark(options);
    return;
  }

  const previousBookmark = getPreviousBookmark();

  if (previousBookmark) {
    const shouldRerunPreviousBookmark = await promptShouldRerunPreviousBookmark(
      formatBookmark(previousBookmark.command),
    );

    if (shouldRerunPreviousBookmark) {
      executeBookmark(previousBookmark.command, options);
      return;
    }
  }

  const bookmarks = getBookmarks();
  const names = sortBookmarksByName(Object.entries(bookmarks)).map(
    ([name]) => name,
  );

  if (names.length === 0) {
    console.log("No bookmarks saved yet.");
    return;
  }

  const selectedBookmark = await promptSelectBookmark(names);
  await runBookmark(selectedBookmark, [], options);
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
  $ scriptpal start
  $ scriptpal bookmark --last
  $ scriptpal bookmark testpkg package=ui-button
  $ scriptpal bookmark testpkg --preview package=ui-button
  $ scriptpal bookmark add --exec testpkg -- yarn test 'src/packages/\${package}'
  $ scriptpal bookmark add --shell pipeline 'printf hello | cat'
  $ scriptpal bookmark run testpkg package=ui-button
  $ scriptpal bookmark add --exec typecheck -- yarn typecheck 'packages/\${pkg:array:or:enum(button|modal|card)}'
  $ scriptpal bookmark run typecheck pkg=button,modal`,
  )
  .argument("[script]")
  .action(async (script, options) =>
    script ? runLocalScript(script) : main(options),
  );

program
  .command("list")
  .alias("ls")
  .description("List available scripts from package.json")
  .action(() => list());

const bookmarkCommand = program
  .command("bookmark")
  .description("Manage custom command bookmarks")
  .option("-l, --last", "Run previous bookmark command")
  .option("--preview", "Show the resolved command without executing or saving history")
  .argument("[name]", "Bookmark to run (omit to open the picker)")
  .argument("[wildcards...]", "Wildcard values in name=value format")
  .addHelpText(
    "after",
    `
Examples
  $ scriptpal bookmark
  $ scriptpal bookmark --last
  $ scriptpal bookmark testpkg package=ui-button
  $ scriptpal bookmark testpkg --preview package=ui-button
  $ scriptpal bookmark add --exec testpkg -- yarn test 'src/packages/\${package}'
  $ scriptpal bookmark add --shell pipeline 'printf hello | cat'
  $ scriptpal bookmark run testpkg package=ui-button`,
  )
  .action((name, wildcardPairs, options) =>
    name ? runBookmark(name, wildcardPairs, options) : pickAndRunBookmark(options),
  );

bookmarkCommand
  .command("add")
  .option("--exec", "Preserve arguments and run without a shell (use -- before the executable)")
  .option("--shell", "Save shell command text (the legacy default)")
  .description("Add a bookmark")
  .argument("<name>")
  .argument("<command...>")
  .action((name, commandParts, options) => addBookmark(name, commandParts, options));

bookmarkCommand
  .command("edit")
  .option("--exec", "Preserve arguments and run without a shell (use -- before the executable)")
  .option("--shell", "Save shell command text (the legacy default)")
  .description("Edit an existing bookmark")
  .argument("<name>")
  .argument("<command...>")
  .action((name, commandParts, options) => editBookmark(name, commandParts, options));

bookmarkCommand
  .command("remove")
  .alias("rm")
  .description("Remove a bookmark")
  .argument("<name>")
  .action((name) => removeBookmark(name));

bookmarkCommand
  .command("list")
  .alias("ls")
  .description("List bookmarks")
  .action(() => listBookmarks());

bookmarkCommand
  .command("run")
  .option("--preview", "Show the resolved command without executing or saving history")
  .description("Run a bookmark and resolve wildcard values")
  .addHelpText(
    "after",
    `
Wildcard syntax
  Scalar wildcard:
    \${name}

  Enum-constrained scalar:
    \${name:enum(button|modal|card)}

  Array wildcard (default render mode is csv):
    \${name:array}
    \${name:array:or}
    \${name:array:brace}
    \${name:array:space}
    \${name:array:csv}

  Enum-constrained arrays:
    \${name:array:or:enum(button|modal|card)}

Array input formats
  name=button
  name=button,modal
  name=button|modal
  name=[button,modal]
  name=(button|modal)

Array render modes
  :or    => (a|b)
  :brace => {a,b}
  :space => a b
  :csv   => a,b`,
  )
  .argument("<name>")
  .argument("[wildcards...]")
  .action((name, wildcardPairs, options) =>
    runBookmark(name, wildcardPairs, { ...bookmarkCommand.opts(), ...options }),
  );

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof PromptInterrupted) process.exit(130);
    console.error(chalk.red(error));
    process.exit(1);
  }
})();
