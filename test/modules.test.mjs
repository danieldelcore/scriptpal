import { describe, expect, it, vi } from "vitest";
import { loadCommonJs } from "./helpers/load-commonjs.mjs";

describe("file manager", () => {
  it("finds and parses package metadata", () => {
    const find = Object.assign(vi.fn(() => "/project/package.json"), {
      read: vi.fn(() => '{"scripts":{"test":"vitest"}}'),
    });
    const { exports: files } = loadCommonJs("file-manager.js", { "find-config": find });
    expect(files.hasFile("package.json")).toBe("/project/package.json");
    expect(files.getPackageJson()).toEqual({ scripts: { test: "vitest" } });
    expect(find.read).toHaveBeenCalledWith("package.json");
  });

  it("accepts a custom filename", () => {
    const find = Object.assign(vi.fn(() => "/project/custom.json"), { read: vi.fn(() => '{}') });
    const { exports: files } = loadCommonJs("file-manager.js", { "find-config": find });
    expect(files.getPackageJson("custom.json")).toEqual({});
    expect(find.read).toHaveBeenCalledWith("custom.json");
  });

  it.each([() => null, () => { throw new Error("unreadable"); }])("handles missing or inaccessible files", (find) => {
    const { exports: files } = loadCommonJs("file-manager.js", { "find-config": find });
    expect(files.hasFile("missing.json")).toBeFalsy();
    expect(() => files.getPackageJson("missing.json")).toThrow(/not found/);
  });

  it("reports malformed JSON", () => {
    const find = Object.assign(() => "/project/package.json", { read: () => "{" });
    const { exports: files } = loadCommonJs("file-manager.js", { "find-config": find });
    expect(() => files.getPackageJson()).toThrow();
  });
});

describe("package manager detection", () => {
  function detect(paths) {
    return loadCommonJs("detect-pkg-manager.js", {
      "./file-manager": { hasFile: (file) => paths[file] ?? null },
    }).exports.getPackageManager();
  }

  it("defaults to npm without a lockfile", () => expect(detect({})).toBe("npm"));
  it.each([
    ["yarn", "yarn.lock"], ["bun", "bun.lockb"],
    ["pnpm", "pnpm-lock.yaml"], ["npm", "package-lock.json"],
  ])("detects %s", (manager, file) => expect(detect({ [file]: `/project/${file}` })).toBe(manager));
  it("prefers the closest lockfile over an ancestor's manager", () => {
    expect(detect({ "yarn.lock": "/parent/yarn.lock", "pnpm-lock.yaml": "/parent/child/pnpm-lock.yaml" })).toBe("pnpm");
  });
  it("uses the established priority when lockfiles share a directory", () => {
    expect(detect({ "yarn.lock": "/project/yarn.lock", "package-lock.json": "/project/package-lock.json" })).toBe("yarn");
  });
});

describe("prompts", () => {
  function setup(answer) {
    const calls = [];
    class Prompt {
      constructor(options) { calls.push(options); }
      async run() { return answer; }
    }
    return {
      calls,
      prompts: loadCommonJs("prompts.js", {
        enquirer: { AutoComplete: Prompt, Snippet: Prompt, Confirm: Prompt, Input: Prompt },
      }).exports,
    };
  }

  it("returns confirmation answers and displays previous commands", async () => {
    const { prompts, calls } = setup(false);
    expect(await prompts.promptShouldRerunPrevious({ script: "test", parameters: "--watch" })).toBe(false);
    expect(calls[0].message).toContain("test --watch");
    expect(await prompts.promptShouldRerunPreviousBookmark("echo previous")).toBe(false);
    expect(calls[1].message).toContain("echo previous");
  });
  it("handles a previous script without parameters", async () => {
    const { prompts, calls } = setup(true);
    expect(await prompts.promptShouldRerunPrevious({ script: "test" })).toBe(true);
    expect(calls[0].message).not.toContain("undefined");
  });
  it("returns wildcard input", async () => {
    const { prompts, calls } = setup("button");
    expect(await prompts.promptGetWildcardValue("package")).toBe("button");
    expect(calls[0].message).toContain("package");
  });
  it("offers supplied bookmarks and returns the selection", async () => {
    const { prompts, calls } = setup("build");
    expect(await prompts.promptSelectBookmark(["build", "test"])).toBe("build");
    expect(calls[0].choices).toEqual(["build", "test"]);
  });
  it("collects script selection and optional parameters", async () => {
    const calls = [];
    class AutoComplete {
      constructor(options) { calls.push(options); }
      async run() { return "test"; }
    }
    class Snippet {
      constructor(options) { calls.push(options); }
      async run() { return { values: { parameters: "--watch" } }; }
    }
    const { exports: prompts } = loadCommonJs("prompts.js", { enquirer: { AutoComplete, Snippet } });
    expect(await prompts.promptGetCommand(["test", "build"])).toEqual({ script: "test", parameters: "--watch" });
    expect(calls[0].choices).toEqual(["test", "build"]);
    expect(calls[1].template).toBe("test ${parameters}");
    expect(calls[1].required).toBe(false);
  });
});

it("prints the welcome logo", () => {
  const log = vi.fn();
  loadCommonJs("welcome.js", {}, { console: { log } }).exports();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("ScriptPal"));
});
