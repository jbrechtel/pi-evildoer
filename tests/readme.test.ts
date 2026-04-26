import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("README documents installation", () => {
  assert.match(readme, /pi install/i);
  assert.match(readme, /pi-superpowers/i);
});

test("README documents required companion packages", () => {
  assert.match(readme, /@juicesharp\/rpiv-todo/);
  assert.match(readme, /pi install npm:@juicesharp\/rpiv-todo/);
  assert.match(readme, /pi-subagents/);
  assert.match(readme, /pi install npm:pi-subagents/);
});

test("README states obra superpowers is canonical", () => {
  assert.match(readme, /obra\/superpowers/);
  assert.match(readme, /canonical/i);
});

test("README documents read-only reviewer agents", () => {
  assert.match(readme, /superpowers-spec-reviewer/);
  assert.match(readme, /superpowers-code-reviewer/);
  assert.match(readme, /agents\//);
  assert.match(readme, /copy.*repository.*customize/is);
  assert.match(readme, /not the builtin.*reviewer/is);
});
