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

test("reviewer agent templates are bundled as pi-subagents agent files", () => {
  const spec = readFileSync("agents/superpowers-spec-reviewer.md", "utf8");
  const code = readFileSync("agents/superpowers-code-reviewer.md", "utf8");

  for (const text of [spec, code]) {
    assert.match(text, /^---\n/);
    assert.match(text, /\nname: superpowers-/);
    assert.match(text, /\ntools: read, grep, find, ls, bash\n/);
    assert.match(text, /\nsystemPromptMode: replace\n/);
    assert.match(text, /\ninheritProjectContext: true\n/);
    assert.match(text, /\ninheritSkills: true\n/);
    assert.match(text, /Do not edit, write, delete, or modify files/);
  }
});

test("skills use todo tool instead of TodoWrite or plan_tracker operational instructions", () => {
  for (const file of allMarkdownFiles(skillsRoot)) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /TodoWrite/, `${file} still mentions TodoWrite`);
    assert.doesNotMatch(text, /plan_tracker/, `${file} still mentions plan_tracker`);
  }
});

test("skills expose workflow monitor artifact and handoff contracts", () => {
  const brainstorming = readSkill("brainstorming/SKILL.md");
  assert.match(brainstorming, /docs\/specs\/YYYY-MM-DD-<topic>-design\.md/);
  assert.match(brainstorming, /\/workflow-next plan <spec-path>/);
  assert.doesNotMatch(brainstorming, /docs\/plans\/.*-design\.md/);

  const writingPlans = readSkill("writing-plans/SKILL.md");
  assert.match(writingPlans, /docs\/plans\/YYYY-MM-DD-<feature-name>\.md/);
  assert.match(writingPlans, /\/workflow-next execute <plan-path>/);
  assert.match(writingPlans, /\/skill:subagent-driven-development/);
  assert.match(writingPlans, /\/skill:executing-plans/);
});

test("execution skills expose todo and pi-subagents workflow monitor contracts", () => {
  const executing = readSkill("executing-plans/SKILL.md");
  assert.match(executing, /todo/i);
  assert.match(executing, /status:\s*"in_progress"/);
  assert.match(executing, /status:\s*"completed"/);
  assert.match(executing, /\/workflow-next verify <plan-path>/);

  const sdd = readSkill("subagent-driven-development/SKILL.md");
  assert.match(sdd, /agent:\s*"worker"/);
  assert.match(sdd, /agent:\s*"superpowers-spec-reviewer"/);
  assert.match(sdd, /agent:\s*"superpowers-code-reviewer"/);
  assert.match(sdd, /Keep these agent names exact|agent names are part of the runtime contract/i);
  assert.doesNotMatch(sdd, /agent:\s*"code-reviewer"/);
  assert.doesNotMatch(sdd, /agent:\s*"spec-reviewer"/);
});
