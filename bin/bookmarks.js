"use strict";

function sortBookmarksByName(entries) {
  return [...entries].sort(([leftName], [rightName]) =>
    leftName.localeCompare(rightName, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );
}

module.exports = {
  sortBookmarksByName,
};
