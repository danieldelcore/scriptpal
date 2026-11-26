import { afterEach, beforeEach, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fileManager = fileURLToPath(new URL("../bin/file-manager.js", import.meta.url));
const detector = fileURLToPath(new URL("../bin/detect-pkg-manager.js", import.meta.url));
let fixture;
let nested;

beforeEach(() => {
  fixture = mkdtempSync(join(tmpdir(), "scriptpal-discovery-"));
  nested = join(fixture, "workspace", "src");
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "echo test" } }));
  writeFileSync(join(fixture, "yarn.lock"), "");
});

afterEach(() => rmSync(fixture, { recursive: true, force: true }));

function discover() {
  const result = spawnSync(process.execPath, ["-e", `
    const { getPackageJson } = require(${JSON.stringify(fileManager)});
    const { getPackageManager } = require(${JSON.stringify(detector)});
    console.log(JSON.stringify({ pkg: getPackageJson(), manager: getPackageManager() }));
  `], { cwd: nested, encoding: "utf8", timeout: 5000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

it("discovers a package and lockfile in an ancestor directory", () => {
  expect(discover()).toEqual({ pkg: { name: "fixture", scripts: { test: "echo test" } }, manager: "yarn" });
});

it("prefers a nested package and its closer lockfile", () => {
  writeFileSync(join(fixture, "workspace", "package.json"), '{"name":"nested"}');
  writeFileSync(join(fixture, "workspace", "pnpm-lock.yaml"), "");
  expect(discover()).toEqual({ pkg: { name: "nested" }, manager: "pnpm" });
});
