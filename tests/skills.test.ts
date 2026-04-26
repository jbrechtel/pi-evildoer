import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const skillsRoot = path.resolve("skills");

function readSkill(relativePath: string): string {
  return readFileSync(path.join(skillsRoot, relativePath), "utf8");
}

function allMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...allMarkdownFiles(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

test("all canonical Superpowers skills are present", () => {
  const required = [
    "brainstorming",
    "dispatching-parallel-agents",
    "executing-plans",
    "finishing-a-development-branch",
    "receiving-code-review",
    "requesting-code-review",
    "subagent-driven-development",
    "systematic-debugging",
    "test-driven-development",
    "using-git-worktrees",
    "using-superpowers",
    "verification-before-completion",
    "writing-plans",
    "writing-skills",
  ];

  for (const name of required) {
    assert.equal(existsSync(path.join(skillsRoot, name, "SKILL.md")), true, `${name} missing`);
  }
});

test("subagent-driven-development uses pi-subagents and keeps canonical statuses", () => {
  const text = readSkill("subagent-driven-development/SKILL.md");
  assert.match(text, /subagent\s*\(\s*\{/);
  assert.match(text, /DONE_WITH_CONCERNS/);
  assert.match(text, /NEEDS_CONTEXT/);
  assert.match(text, /BLOCKED/);
  assert.match(text, /spec compliance.*code quality/is);
  assert.match(text, /superpowers-spec-reviewer/);
  assert.match(text, /superpowers-code-reviewer/);
  assert.doesNotMatch(text, /agentScope\s*:/);
  assert.doesNotMatch(text, /scope:\s*"user"/);
  assert.doesNotMatch(text, /agent:\s*"reviewer"/);
  assert.doesNotMatch(text, /Task\(/);
  assert.doesNotMatch(text, /Task tool/i);
});

test("parallel agents skill uses subagent parallel mode", () => {
  const text = readSkill("dispatching-parallel-agents/SKILL.md");
  assert.match(text, /subagent\s*\(\s*\{\s*tasks:/s);
  assert.doesNotMatch(text, /Task\(/);
  assert.doesNotMatch(text, /Task tool/i);
});

test("reviewer agent templates are bundled with the package", () => {
  assert.equal(existsSync("agents/superpowers-spec-reviewer.md"), true);
  assert.equal(existsSync("agents/superpowers-code-reviewer.md"), true);
});

test("skills use todo tool instead of TodoWrite or plan_tracker operational instructions", () => {
  for (const file of allMarkdownFiles(skillsRoot)) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /TodoWrite/, `${file} still mentions TodoWrite`);
    assert.doesNotMatch(text, /plan_tracker/, `${file} still mentions plan_tracker`);
  }
});

test("canonical strict TDD language is preserved", () => {
  const text = readSkill("test-driven-development/SKILL.md");
  assert.match(text, /NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST/);
  assert.doesNotMatch(text, /Three Scenarios/i);
});
