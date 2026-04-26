import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOTSTRAP_MARKER,
  buildBootstrapPrompt,
  buildCompanionNotice,
  shouldInjectBootstrap,
  stripFrontmatter,
} from "../extensions/bootstrap.ts";

test("stripFrontmatter removes YAML frontmatter", () => {
  const input = "---\nname: using-superpowers\ndescription: test\n---\n\n# Body";
  assert.equal(stripFrontmatter(input).trim(), "# Body");
});

test("bootstrap prompt injects Superpowers behavior and Pi tool mappings", () => {
  const prompt = buildBootstrapPrompt("# Using Skills\n\nInvoke relevant skills BEFORE any response.");
  assert.match(prompt, /You have superpowers/i);
  assert.match(prompt, /using-superpowers skill content is included below/i);
  assert.match(prompt, /Invoke relevant skills BEFORE any response/i);
  assert.match(prompt, /TodoWrite\s*→\s*todo/);
  assert.match(prompt, /@juicesharp\/rpiv-todo/);
  assert.match(prompt, /Task.*subagent/i);
  assert.match(prompt, /pi-subagents/i);
  assert.match(prompt, new RegExp(BOOTSTRAP_MARKER));
});

test("bootstrap is not injected twice", () => {
  assert.equal(shouldInjectBootstrap("base prompt"), true);
  assert.equal(shouldInjectBootstrap(`base prompt\n${BOOTSTRAP_MARKER}`), false);
});

test("companion notice reports missing runtime tools", () => {
  assert.equal(buildCompanionNotice(["todo", "subagent"]), "");

  const missingSubagent = buildCompanionNotice(["todo"]);
  assert.match(missingSubagent, /pi-subagents/);
  assert.match(missingSubagent, /subagent/);

  const missingTodo = buildCompanionNotice(["subagent"]);
  assert.match(missingTodo, /@juicesharp\/rpiv-todo/);
  assert.match(missingTodo, /todo/);
});
