import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedThinkingPhaseWrite,
  isSourceFile,
  isTestFile,
} from "../extensions/workflow-monitor/heuristics.ts";
import { parseTestCommand, parseTestResult } from "../extensions/workflow-monitor/test-runner.ts";
import {
  parseSkillName,
  SKILL_TO_PHASE,
  WORKFLOW_PHASES,
} from "../extensions/workflow-monitor/workflow-tracker.ts";

test("thinking phases allow canonical Superpowers spec and plan paths", () => {
  assert.equal(isAllowedThinkingPhaseWrite("docs/superpowers/specs/2026-04-26-design.md", process.cwd()), true);
  assert.equal(isAllowedThinkingPhaseWrite("docs/superpowers/plans/2026-04-26-plan.md", process.cwd()), true);
});

test("thinking phases do not allow source writes", () => {
  assert.equal(isAllowedThinkingPhaseWrite("src/index.ts", process.cwd()), false);
  assert.equal(isAllowedThinkingPhaseWrite("extensions/bootstrap.ts", process.cwd()), false);
});

test("file heuristics classify source and tests", () => {
  assert.equal(isTestFile("src/foo.test.ts"), true);
  assert.equal(isTestFile("tests/foo.test.ts"), true);
  assert.equal(isSourceFile("src/foo.ts"), true);
  assert.equal(isSourceFile("src/foo.test.ts"), false);
  assert.equal(isSourceFile("README.md"), false);
});

test("test runner detection recognizes common test commands", () => {
  assert.equal(parseTestCommand("npm test"), true);
  assert.equal(parseTestCommand("pnpm test"), true);
  assert.equal(parseTestCommand("node --test tests/foo.test.ts"), true);
  assert.equal(parseTestCommand("git status"), false);
});

test("test result parser uses exit code first", () => {
  assert.equal(parseTestResult("whatever", 0), true);
  assert.equal(parseTestResult("whatever", 1), false);
});

test("skill parsing maps canonical workflow skills to phases", () => {
  assert.equal(parseSkillName("/skill:brainstorming"), "brainstorming");
  assert.equal(parseSkillName("Use superpowers:writing-plans"), "writing-plans");
  assert.equal(SKILL_TO_PHASE["brainstorming"], "brainstorm");
  assert.equal(SKILL_TO_PHASE["writing-plans"], "plan");
  assert.deepEqual(WORKFLOW_PHASES, ["brainstorm", "plan", "execute", "verify", "review", "finish"]);
});
