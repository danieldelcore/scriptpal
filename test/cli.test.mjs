import { describe, expect, it, vi } from "vitest";
import { loadCommonJs } from "./helpers/load-commonjs.mjs";

async function run(args = [], options = {}) {
  const store = new Map(Object.entries(options.store ?? {}));
  class Conf {
    get(key, fallback) { return store.has(key) ? store.get(key) : fallback; }
    set(key, value) { store.set(key, value); }
  }
  const spawnSync = vi.fn(() => options.spawnResult ?? { status: 0 });
  const write = vi.fn(async () => {});
  const log = vi.fn();
  const error = vi.fn();
  const exit = vi.fn();
  const welcome = vi.fn();
  const prompts = {
    promptShouldRerunPrevious: vi.fn(async () => options.rerun ?? false),
    promptShouldRerunPreviousBookmark: vi.fn(async () => options.rerun ?? false),
    promptGetCommand: vi.fn(async () => options.selection ?? { script: "test", parameters: "" }),
    promptGetWildcardValue: vi.fn(async () => "button"),
    promptSelectBookmark: vi.fn(async () => options.bookmark ?? "build"),
  };
  const { completion } = loadCommonJs("index.js", {
    conf: Conf,
    child_process: { spawnSync },
    clipboardy: { write },
    "./welcome": welcome,
    "./file-manager": { getPackageJson: () => options.packageJson ?? { scripts: { test: "vitest", build: "build" } } },
    "./detect-pkg-manager": { getPackageManager: () => options.manager ?? "npm" },
    "./prompts": prompts,
  }, {
    process: { argv: ["node", "scriptpal", ...args], cwd: () => "/project", exit },
    console: { log, error },
  });
  await completion;
  return { store, spawnSync, write, log, error, exit, welcome, prompts };
}

function expectFailure(result, message) {
  expect(result.exit).toHaveBeenCalledWith(1);
  expect(String(result.error.mock.calls[0][0])).toContain(message);
  expect(result.spawnSync).not.toHaveBeenCalled();
}

describe("local scripts", () => {
  it.each(["npm", "yarn", "pnpm", "bun"])("runs scripts using %s", async (manager) => {
    const result = await run(["test"], { manager });
    expect(result.spawnSync).toHaveBeenCalledWith(manager, manager === "npm" ? ["run", "test"] : ["test"], { stdio: "inherit" });
    expect(result.prompts.promptGetCommand).not.toHaveBeenCalled();
  });
  it("rejects an unknown script", async () => expectFailure(await run(["missing"]), 'Script "missing" not found'));
  it("rejects packages without scripts", async () => expectFailure(await run(["list"], { packageJson: {} }), 'No "scripts" found'));
  it.each(["list", "ls"])("lists scripts with %s", async (command) => {
    const result = await run([command]);
    expect(result.log.mock.calls.flat().join("\n")).toMatch(/test:.*vitest/);
    expect(result.spawnSync).not.toHaveBeenCalled();
  });
  it("selects a script, includes parameters and saves it", async () => {
    const result = await run([], { selection: { script: "test", parameters: "--watch" } });
    expect(result.welcome).toHaveBeenCalledOnce();
    expect(result.prompts.promptGetCommand).toHaveBeenCalledWith(["test", "build"]);
    expect(result.spawnSync).toHaveBeenCalledWith("npm", ["run", "test", "--watch"], { stdio: "inherit" });
    expect(result.store.get("/project.previous")).toEqual({ script: "test", parameters: "--watch" });
  });
  it("omits the welcome with --nowelcome", async () => {
    expect((await run(["--nowelcome"])).welcome).not.toHaveBeenCalled();
  });
  it.each([true, false])("honors the rerun answer %s", async (rerun) => {
    const result = await run([], { rerun, store: { "/project.previous": { script: "build" } } });
    expect(result.prompts.promptShouldRerunPrevious).toHaveBeenCalledWith({ script: "build" });
    expect(result.spawnSync.mock.calls[0][1]).toEqual(["run", rerun ? "build" : "test"]);
  });
  it("reruns --last without prompting", async () => {
    const result = await run(["--last"], { store: { "/project.previous": { script: "build" } } });
    expect(result.spawnSync.mock.calls[0][1]).toEqual(["run", "build"]);
    expect(result.prompts.promptShouldRerunPrevious).not.toHaveBeenCalled();
    expect(result.prompts.promptGetCommand).not.toHaveBeenCalled();
  });
  it("falls back to selection when --last has no history", async () => {
    const result = await run(["--last"]);
    expect(result.log).toHaveBeenCalledWith(expect.stringContaining("Previous command not found"));
    expect(result.prompts.promptGetCommand).toHaveBeenCalledOnce();
  });
  it("copies to clipboard without running or updating history", async () => {
    const result = await run(["--clipboard"], { selection: { script: "test", parameters: "--watch" } });
    expect(result.write).toHaveBeenCalledWith("npm run test --watch");
    expect(result.spawnSync).not.toHaveBeenCalled();
    expect(result.store.has("/project.previous")).toBe(false);
  });
  it("combines last, clipboard and nowelcome flags", async () => {
    const result = await run(["-lcn"], { manager: "yarn", store: { "/project.previous": { script: "build" } } });
    expect(result.write).toHaveBeenCalledWith("yarn build");
    expect(result.welcome).not.toHaveBeenCalled();
    expect(result.spawnSync).not.toHaveBeenCalled();
  });
});

describe("bookmark management", () => {
  it("adds a command assembled from multiple parts", async () => {
    const result = await run(["bookmark", "add", "build", "echo", "hello"]);
    expect(result.store.get("bookmarks")).toEqual({ build: "echo hello" });
  });
  it("rejects duplicate bookmarks", async () => {
    const result = await run(["bookmark", "add", "build", "echo new"], { store: { bookmarks: { build: "echo old" } } });
    expectFailure(result, "already exists");
    expect(result.store.get("bookmarks").build).toBe("echo old");
  });
  it.each(["add", "edit"])("rejects an empty %s command", async (command) => {
    expectFailure(await run(["bookmark", command, "build", "  "]), "cannot be empty");
  });
  it("edits an existing bookmark", async () => {
    const result = await run(["bookmark", "edit", "build", "echo new"], { store: { bookmarks: { build: "echo old" } } });
    expect(result.store.get("bookmarks").build).toBe("echo new");
  });
  it("rejects editing a missing bookmark", async () => expectFailure(await run(["bookmark", "edit", "missing", "echo x"]), "not found"));
  it.each(["remove", "rm"])("removes with %s and preserves other bookmarks", async (command) => {
    const result = await run(["bookmark", command, "build"], { store: { bookmarks: { build: "echo build", test: "echo test" } } });
    expect(result.store.get("bookmarks")).toEqual({ test: "echo test" });
  });
  it("rejects removing a missing bookmark", async () => expectFailure(await run(["bookmark", "remove", "missing"]), "not found"));
  it.each(["list", "ls"])("sorts bookmarks using %s", async (command) => {
    const result = await run(["bookmark", command], { store: { bookmarks: { zebra: "echo z", alpha: "echo a" } } });
    expect(result.log.mock.calls[0][0]).toContain("alpha");
    expect(result.log.mock.calls[1][0]).toContain("zebra");
  });
  it.each([[], ["list"]])("handles an empty bookmark store (%j)", async (...args) => {
    const result = await run(["bookmark", ...args]);
    expect(result.log).toHaveBeenCalledWith("No bookmarks saved yet.");
    expect(result.spawnSync).not.toHaveBeenCalled();
  });
  it("reports missing previous bookmark history", async () => {
    const result = await run(["bookmark", "--last"]);
    expect(result.log).toHaveBeenCalledWith("Previous bookmark command not found.");
    expect(result.spawnSync).not.toHaveBeenCalled();
  });
  it.each([true, false])("honors the previous-bookmark answer %s", async (rerun) => {
    const result = await run(["bookmark"], { rerun, store: { bookmarks: { build: "echo build" }, "bookmark.previous": { command: "echo previous" } } });
    expect(result.spawnSync).toHaveBeenCalledWith(rerun ? "echo previous" : "echo build", { stdio: "inherit", shell: true });
    expect(result.prompts.promptSelectBookmark).toHaveBeenCalledTimes(rerun ? 0 : 1);
  });
  it("sorts picker choices and resolves missing wildcards only once", async () => {
    const result = await run(["bookmark"], { store: { bookmarks: { zebra: "echo z", build: "echo ${pkg} ${pkg}" } } });
    expect(result.prompts.promptSelectBookmark).toHaveBeenCalledWith(["build", "zebra"]);
    expect(result.prompts.promptGetWildcardValue).toHaveBeenCalledExactlyOnceWith("pkg");
    expect(result.spawnSync.mock.calls[0][0]).toBe("echo button button");
    expect(result.store.get("bookmark.previous")).toEqual({ command: "echo button button" });
  });
  it("prompts only for wildcard values not supplied", async () => {
    const result = await run(["bookmark", "run", "build", "kind=ui"], { store: { bookmarks: { build: "echo ${kind} ${pkg}" } } });
    expect(result.prompts.promptGetWildcardValue).toHaveBeenCalledExactlyOnceWith("pkg");
    expect(result.spawnSync.mock.calls[0][0]).toBe("echo ui button");
  });
  it("does not execute or change history after wildcard validation fails", async () => {
    const result = await run(["bookmark", "build", "pkg=invalid"], { store: { bookmarks: { build: "echo ${pkg:enum(button|modal)}" }, "bookmark.previous": { command: "echo old" } } });
    expectFailure(result, "Invalid value");
    expect(result.store.get("bookmark.previous")).toEqual({ command: "echo old" });
  });
});

describe("child process failures", () => {
  it.each([["test"], ["bookmark", "build"]])("propagates exit status for %j", async (...args) => {
    const result = await run(args, { store: { bookmarks: { build: "exit 7" } }, spawnResult: { status: 7 } });
    expect(result.exit).toHaveBeenCalledWith(7);
  });
  it.each([["test"], ["bookmark", "build"]])("reports spawn errors for %j", async (...args) => {
    const result = await run(args, { store: { bookmarks: { build: "echo build" } }, spawnResult: { error: new Error("spawn failed") } });
    expect(result.exit).toHaveBeenCalledWith(1);
    expect(String(result.error.mock.calls[0][0])).toContain("spawn failed");
  });
});

describe("exec bookmark interactive flows", () => {
  const command = { mode: "exec", executable: "echo", args: ["${name}", "${name}"] };

  it("resolves a missing value once across separate arguments", async () => {
    const result = await run(["bookmark"], { store: { bookmarks: { build: command } } });
    expect(result.prompts.promptGetWildcardValue).toHaveBeenCalledExactlyOnceWith("name");
    expect(result.spawnSync).toHaveBeenCalledWith("echo", ["button", "button"], { stdio: "inherit", shell: false });
  });

  it("previews a selected bookmark without running or updating history", async () => {
    const result = await run(["bookmark", "--preview"], { store: { bookmarks: { build: command } } });
    expect(result.log).toHaveBeenCalledWith('[exec] ["echo","button","button"]');
    expect(result.spawnSync).not.toHaveBeenCalled();
    expect(result.store.has("bookmark.previous")).toBe(false);
  });

  it("displays and reruns a structured previous command", async () => {
    const previous = { ...command, args: ["hello world", ""] };
    const result = await run(["bookmark"], { rerun: true, store: { "bookmark.previous": { command: previous } } });
    expect(result.prompts.promptShouldRerunPreviousBookmark).toHaveBeenCalledWith('[exec] ["echo","hello world",""]');
    expect(result.spawnSync).toHaveBeenCalledWith("echo", ["hello world", ""], { stdio: "inherit", shell: false });
  });

  it("retains exec mode when editing without a mode flag", async () => {
    const result = await run(["bookmark", "edit", "build", "echo", "hello world"], { store: { bookmarks: { build: command } } });
    expect(result.store.get("bookmarks").build).toEqual({ mode: "exec", executable: "echo", args: ["hello world"] });
  });

  it("can explicitly switch exec bookmarks back to shell mode", async () => {
    const result = await run(["bookmark", "edit", "--shell", "build", "echo hello | cat"], { store: { bookmarks: { build: command } } });
    expect(result.store.get("bookmarks").build).toBe("echo hello | cat");
  });

  it.each(["__proto__", "toString"])("prompts for a wildcard named %s", async (name) => {
    const result = await run(["bookmark", "build"], { store: { bookmarks: { build: { ...command, args: ["${" + name + "}"] } } } });
    expect(result.prompts.promptGetWildcardValue).toHaveBeenCalledExactlyOnceWith(name);
    expect(result.spawnSync.mock.calls[0][1]).toEqual(["button"]);
  });
});
