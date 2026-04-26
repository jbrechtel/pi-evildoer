import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedThinkingPhaseWrite,
  isSourceFile,
  isTestFile,
} from "../extensions/workflow-monitor/heuristics.ts";
import { parseTestCommand, parseTestResult } from "../extensions/workflow-monitor/test-runner.ts";
import { createWorkflowHandler } from "../extensions/workflow-monitor/workflow-handler.ts";
import {
  parseSkillName,
  SKILL_TO_PHASE,
  WORKFLOW_PHASES,
} from "../extensions/workflow-monitor/workflow-tracker.ts";

test("thinking phases allow canonical Superpowers spec and plan paths", () => {
  assert.equal(isAllowedThinkingPhaseWrite("docs/specs/2026-04-26-design.md", process.cwd()), true);
  assert.equal(isAllowedThinkingPhaseWrite("docs/plans/2026-04-26-plan.md", process.cwd()), true);
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

test("test runner detection recognizes mise test commands", () => {
  assert.equal(parseTestCommand("mise run test"), true);
  assert.equal(parseTestCommand("mise test"), true);
  assert.equal(parseTestCommand("mise exec -- npm test"), true);
  assert.equal(parseTestCommand("mise exec node@24 -- node --test tests/foo.test.ts"), true);
  assert.equal(parseTestCommand("mise exec -- git status"), false);
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

test("workflow handler flags source writes during brainstorm", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:brainstorming");
  const result = handler.handleToolCall("write", { path: "src/index.ts" });
  assert.equal(result.violation?.type, "process-write-during-thinking");
});

test("workflow handler allows canonical spec writes during brainstorm", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:brainstorming");
  const result = handler.handleToolCall("write", { path: "docs/specs/example-design.md" });
  assert.equal(result.violation, undefined);
});

test("workflow handler records source edit and warns before commit without verification", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:executing-plans");
  handler.handleFileWritten("src/index.ts");
  const violation = handler.checkCommitGate("git commit -m test");
  assert.equal(violation?.type, "commit-without-verification");
});

test("workflow handler state is serializable and reconstructable", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:writing-plans");
  const snapshot = handler.getFullState();

  const restored = createWorkflowHandler();
  restored.setFullState(snapshot);

  assert.deepEqual(restored.getFullState(), snapshot);
});
