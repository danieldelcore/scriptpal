#!/usr/bin/env node
"use strict";

const fs = require("fs");
const chalk = require("chalk");
const { promisify } = require("util");

const readFile = promisify(fs.readFile);

function getPackageJson(path) {
  if (!hasFile(path)) {
    throw new Error(`${chalk.red("Error:")} ${chalk.bgRed(path)} ${chalk.red(
      "not found"
    )}\n`);
  }

  return readFile(path).then(rawdata => JSON.parse(rawdata));
}

function hasFile(path) {
  try {
    return fs.existsSync(path);
  } catch (error) {
    return false;
  }
}

module.exports = {
  getPackageJson,
  hasFile
};
