"use strict";

function createBookmark(commandParts, options = {}) {
  if (options.exec && options.shell) {
    throw new Error("Choose either --exec or --shell, not both.");
  }

  if (options.exec) {
    const [executable, ...args] = commandParts;
    if (!executable || !executable.trim()) {
      throw new Error("Bookmark command cannot be empty.");
    }
    if (executable.includes("${")) {
      throw new Error("The executable must be literal; put wildcards in arguments.");
    }
    return { mode: "exec", executable, args };
  }

  const command = commandParts.join(" ").trim();
  if (!command) {
    throw new Error("Bookmark command cannot be empty.");
  }
  return command;
}

function formatBookmark(command) {
  // JSON makes argument boundaries and empty strings visible without implying
  // that this display string is shell syntax that can be executed.
  return typeof command === "string"
    ? command
    : `[exec] ${JSON.stringify([command.executable, ...command.args])}`;
}

function sortBookmarksByName(entries) {
  return [...entries].sort(([leftName], [rightName]) =>
    leftName.localeCompare(rightName, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

module.exports = {
  createBookmark,
  formatBookmark,
  sortBookmarksByName,
};
