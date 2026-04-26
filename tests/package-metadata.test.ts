import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package is an installable Pi package", () => {
  assert.equal(pkg.name, "pi-superpowers");
  assert.equal(pkg.type, "module");
  assert.ok(pkg.keywords.includes("pi-package"));
});

test("package exposes only owned extensions and skills", () => {
  assert.deepEqual(pkg.pi.skills, ["skills"]);
  assert.deepEqual(pkg.pi.extensions, [
    "extensions/bootstrap.ts",
    "extensions/workflow-monitor.ts",
  ]);
});

test("package has matching MIT license metadata and file", () => {
  assert.equal(pkg.license, "MIT");
  assert.equal(existsSync(new URL("../LICENSE", import.meta.url)), true);
});

test("test script runs root test files without fragile recursive shell globs", () => {
  assert.equal(pkg.scripts.test, "node --experimental-strip-types --test tests/*.test.ts");
});

test("imported Pi core packages are peer dependencies", () => {
  assert.deepEqual(pkg.peerDependencies, {
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*"
  });
});
