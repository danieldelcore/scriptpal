import { describe, it, expect } from "vitest";
import bookmarks from "../bin/bookmarks.js";

const { sortBookmarksByName } = bookmarks;

describe("sortBookmarksByName", () => {
  it("sorts bookmark names alphabetically", () => {
    const sorted = sortBookmarksByName([
      ["zebra", "echo zebra"],
      ["alpha", "echo alpha"],
      ["middle", "echo middle"],
    ]);

    expect(sorted.map(([name]) => name)).toEqual(["alpha", "middle", "zebra"]);
  });

  it("sorts case-insensitively and keeps numeric order", () => {
    const sorted = sortBookmarksByName([
      ["task10", "echo 10"],
      ["Task2", "echo 2"],
      ["task1", "echo 1"],
    ]);

    expect(sorted.map(([name]) => name)).toEqual(["task1", "Task2", "task10"]);
  });
});
