import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

// Vitest's module mocks do not intercept CommonJS require calls. Load our
// modules in a fresh context with explicit dependency doubles instead.
export function loadCommonJs(file, mocks = {}, globals = {}) {
  const url = new URL(`../../bin/${file}`, import.meta.url);
  const realRequire = createRequire(url);
  const module = { exports: {} };
  const completion = vm.runInNewContext(readFileSync(url, "utf8"), {
    module,
    exports: module.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : realRequire(name),
    console,
    process,
    ...globals,
  }, { filename: url.pathname });
  return { exports: module.exports, completion };
}
