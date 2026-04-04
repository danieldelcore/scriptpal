<p align="center">
  <img width="580" src="assets/logo.png" alt="Script Palette">
</p>

# ScriptPal 🤘

A simple npm script palette for lazy people who want a quick way to look through and pick npm scripts!

- keyboard navigation
- autocompletion
- fuzzy finding

<p align="center">
  <img width="580" src="assets/demo.gif" alt="Demo">
</p>

## Install ⬇️

Install globally

```bash
npm install -g scriptpal
```

## Usage 🏁

```bash
scriptpal
```

Usage with npx

```bash
npx scriptpal
```

## API 🤖

- `--nowelcome`, `-n` Omit welcome message
- `--last`, `-l` Run previous command
- `--version`, `-v` Version number
- `--clipboard`, `-c` Copy command to clipboard
- `--help` Help me 🙏

## `list`

`list` List all scripts found in local `package.json`.

It's possible to also run arbitrary scripts from your `package.json` by passing them as sub-commands, similar to `yarn`.

For example: `scriptpal test` will run `npm run test`.

## Examples

- `$ scriptpal` => Shows a prompt containing a list of npm scripts from the closest `package.json`.
- `$ scriptpal --last` => Runs the previous command
- `$ scriptpal list` => Prints all npm scripts from the closest `package.json`.
- `$ scriptpal start` => Runs `npm run start`. Can be used with other scripts as well.

## You might also like...

- [CommitPal](https://github.com/zeropoly/commitpal): A delightful CLI tool for building complex commit messages
- [Enquirer](https://github.com/enquirer/enquirer): Stylish, intuitive and user-friendly prompts
