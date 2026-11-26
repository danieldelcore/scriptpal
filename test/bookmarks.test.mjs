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

it("sorts without mutating the input entries", () => {
  const entries = [["z", "echo z"], ["a", "echo a"]];
  const sorted = sortBookmarksByName(entries);
  expect(entries.map(([name]) => name)).toEqual(["z", "a"]);
  expect(sorted).toEqual([["a", "echo a"], ["z", "echo z"]]);
});

it("handles an empty bookmark list", () => {
  expect(sortBookmarksByName([])).toEqual([]);
});

describe("bookmark storage formats", () => {
  const { createBookmark, formatBookmark } = bookmarks;
  it("preserves argument boundaries in exec mode", () => {
    const command = createBookmark(["echo", "hello world", ""], { exec: true });
    expect(command).toEqual({ mode: "exec", executable: "echo", args: ["hello world", ""] });
    expect(formatBookmark(command)).toBe('[exec] ["echo","hello world",""]');
  });
  it("keeps legacy shell storage and explicit shell mode compatible", () => {
    expect(createBookmark(["echo", "hello"])).toBe("echo hello");
    expect(createBookmark(["echo hello | cat"], { shell: true })).toBe("echo hello | cat");
    expect(formatBookmark("echo hello")).toBe("echo hello");
  });
  it("rejects conflicting execution modes", () => {
    expect(() => createBookmark(["echo"], { exec: true, shell: true })).toThrow(/Choose either/);
  });
  it.each([[], [""], ["  "]])("rejects empty executables: %j", (...parts) => {
    expect(() => createBookmark(parts, { exec: true })).toThrow(/cannot be empty/);
  });
  it("requires a literal executable", () => {
    expect(() => createBookmark(["${exe}"], { exec: true })).toThrow(/executable must be literal/);
  });
});
