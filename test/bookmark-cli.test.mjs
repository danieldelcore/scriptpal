import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
let configDir;

// Exercise the real CLI and shell commands with an isolated Conf store.
function cli(...args) {
  return cliWithInput("", ...args);
}

function cliWithInput(input, ...args) {
  const result = spawnSync(process.execPath, ["-e", `
    const Conf = require("conf");
    require.cache[require.resolve("conf")] = { exports: class extends Conf {
      constructor() { super({ cwd: process.env.SCRIPTPAL_TEST_CONFIG }); }
    } };
    process.argv = [process.execPath, "bin/index.js", ...process.argv.slice(1)];
    require("./bin/index.js");
  `, "--", ...args], {
    cwd: root,
    env: { ...process.env, SCRIPTPAL_TEST_CONFIG: configDir },
    input,
    encoding: "utf8",
    timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  return result;
}

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "scriptpal-cli-"));
  expect(cli("bookmark", "add", "previous", "echo previous-output").status).toBe(0);
  expect(cli("bookmark", "run", "previous").stdout).toContain("previous-output");
  expect(cli("bookmark", "add", "my-bookmark", "echo requested-${value}").status).toBe(0);
});

afterEach(() => rmSync(configDir, { recursive: true, force: true }));

describe("bookmark CLI routing", () => {
  it("runs a named bookmark with wildcard arguments instead of prompting to rerun", () => {
    const result = cli("bookmark", "my-bookmark", "value=my-arg");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("requested-my-arg");
    expect(result.stdout).not.toContain("rerun the previous");
    expect(cli("bookmark", "--last").stdout.trim()).toBe("requested-my-arg");
  });

  it("reports a missing bookmark instead of offering the previous command", () => {
    const result = cli("bookmark", "missing");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Bookmark "missing" not found.');
    expect(result.stdout).not.toContain("rerun the previous");
  });

  it("runs a named bookmark without wildcards directly", () => {
    const result = cli("bookmark", "previous");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("previous-output");
  });

  it("reports invalid wildcard arguments instead of offering the previous command", () => {
    const result = cli("bookmark", "my-bookmark", "my-arg");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid wildcard "my-arg". Expected format: name=value');
    expect(result.stdout).not.toContain("rerun the previous");
  });

  it("retains the explicit run subcommand", () => {
    const result = cli("bookmark", "run", "my-bookmark", "value=explicit");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("requested-explicit");
  });

  it("still offers to rerun when no bookmark name is supplied", () => {
    expect(cli("bookmark").stdout).toContain("rerun the previous bookmark command?");
  });

  it.each([
    [["bookmark"], "rerun the previous bookmark command?"],
    [["bookmark", "my-bookmark"], "Provide value for"],
  ])("exits quietly when Ctrl+C cancels %j", (args, prompt) => {
    const result = cliWithInput("\x03", ...args);
    expect(result.stdout).toContain(prompt);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(130);
    expect(cli("bookmark", "--last").stdout.trim()).toBe("previous-output");
  });
});

// This child reports the actual argv received from the operating system.
const reportArgs = "process.stdout.write(JSON.stringify(process.argv.slice(1)))";
function addExec(name, ...args) {
  const result = cli("bookmark", "add", "--exec", name, "--", process.execPath, "-e", reportArgs, "--", ...args);
  expect(result.status, result.stderr).toBe(0);
}

describe("argument-safe bookmarks", () => {
  it.each([
    "hello world", "O'Reilly", 'say "hello"', "$HOME", "$(echo unexpected)",
    "`echo unexpected`", "x; echo unexpected", "x & echo unexpected", "a|b",
    "", "  padded  ", "line one\nline two", "C:\\some path\\file", "*.js",
  ])("passes scalar value %j literally to the child", (value) => {
    addExec("literal", "${value}", "prefix=${value}", "${value}");
    const result = cli("bookmark", "literal", `value=${value}`);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([value, `prefix=${value}`, value]);
  });

  it("preserves saved argument boundaries including empty and quoted arguments", () => {
    addExec("boundaries", "hello world", "", 'a"b', "a'b", "a\\b");
    const result = cli("bookmark", "boundaries");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(["hello world", "", 'a"b', "a'b", "a\\b"]);
  });

  it("renders space arrays as separate arguments and other modes as single arguments", () => {
    addExec("arrays", "${items:array:space}", "${items:array:csv}", "${items:array:brace}", "packages/${items:array:or}");
    const result = cli("bookmark", "arrays", "items=hello world,other item");
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      "hello world", "other item", "hello world,other item", "{hello world,other item}", "packages/(hello world|other item)",
    ]);
  });

  it("rejects space arrays embedded in an argument", () => {
    addExec("embedded", "prefix=${items:array:space}");
    const result = cli("bookmark", "embedded", "items=a,b");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must occupy a whole argument");
  });

  it("keeps exact resolved arguments when rerunning the previous bookmark", () => {
    addExec("history", "${value}");
    const first = cli("bookmark", "history", 'value=hello "world"; $HOME');
    const last = cli("bookmark", "--last");
    expect(last.status, last.stderr).toBe(0);
    expect(JSON.parse(last.stdout)).toEqual(['hello "world"; $HOME']);
    expect(last.stdout).toBe(first.stdout);
  });

  it.each([
    ["bookmark", "--preview", "previewed"],
    ["bookmark", "run", "--preview", "previewed"],
    ["bookmark", "--preview", "run", "previewed"],
  ])("previews arguments without executing or changing history: %j", (...args) => {
    addExec("previewed", "${value}");
    const result = cli(...args, "value=hello world");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("[exec]");
    const preview = JSON.parse(result.stdout.slice("[exec] ".length));
    expect(preview.at(-1)).toBe("hello world");
    expect(cli("bookmark", "--last").stdout.trim()).toBe("previous-output");
  });

  it("previews the previous bookmark without running it", () => {
    const result = cli("bookmark", "--last", "--preview");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("[shell] echo previous-output");
  });

  it("edits legacy bookmarks into exec bookmarks and displays their arguments", () => {
    const edited = cli("bookmark", "edit", "--exec", "my-bookmark", "--", process.execPath, "-e", reportArgs, "--", "hello world");
    expect(edited.status, edited.stderr).toBe(0);
    expect(JSON.parse(cli("bookmark", "my-bookmark").stdout)).toEqual(["hello world"]);
    expect(cli("bookmark", "list").stdout).toContain('[exec]');
  });

  it("supports explicit shell commands with pipelines", () => {
    expect(cli("bookmark", "add", "--shell", "pipeline", "printf hello | cat").status).toBe(0);
    expect(cli("bookmark", "pipeline").stdout).toBe("hello");
  });

  it("reports executable failures", () => {
    expect(cli("bookmark", "add", "--exec", "failure", "--", process.execPath, "-e", "process.exit(7)").status).toBe(0);
    expect(cli("bookmark", "failure").status).toBe(7);
    expect(cli("bookmark", "add", "--exec", "missing-exe", "--", "scriptpal-nonexistent-test-executable").status).toBe(0);
    const result = cli("bookmark", "missing-exe");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ENOENT");
  });
});
