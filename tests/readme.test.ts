import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("README documents installation", () => {
  assert.match(readme, /pi install npm:@casualjim\/pi-superpowers/);
  assert.match(readme, /pi install git:github\.com\/casualjim\/pi-superpowers/);
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

test("README acknowledges pi-superpowers-plus workflow monitor prior art", () => {
  assert.match(readme, /coctostan\/pi-superpowers-plus/);
  assert.match(readme, /workflow-monitor runtime design/i);
  assert.match(readme, /TUI workflow strip/);
});

test("README documents workflow monitor runtime commands and boundaries", () => {
  assert.match(readme, /\/workflow-next/);
  assert.match(readme, /\/workflow-reset/);
  assert.match(readme, /docs\/specs\/.*-design\.md/);
  assert.match(readme, /docs\/plans\//);
  assert.match(readme, /todo.*execution/i);
  assert.match(readme, /subagent.*review/i);
  assert.match(readme, /git commit/);
  assert.match(readme, /gh pr create/);
});

test("README documents read-only reviewer agents", () => {
  assert.match(readme, /superpowers-spec-reviewer/);
  assert.match(readme, /superpowers-code-reviewer/);
  assert.match(readme, /agents\//);
  assert.match(readme, /copy.*repository.*customize/is);
  assert.match(readme, /not the builtin.*reviewer/is);
});

test("README documents Docker integration test", () => {
  assert.match(readme, /mise run test:integration/);
  assert.doesNotMatch(readme, /test:integration:local/);
  assert.match(readme, /ZAI_API_KEY/);
  assert.match(readme, /zai\/glm-5-turbo/);
  assert.match(readme, /Docker/i);
  assert.match(readme, /@thesethrose\/pi-zai-provider/);
});
