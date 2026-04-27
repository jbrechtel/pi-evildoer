import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyPath,
  findCorrespondingTestFile,
  isAllowedThinkingPhaseWrite,
  isSourceFile,
  isTestFile,
} from "../extensions/workflow-monitor/heuristics.ts";
import { parseTestCommand, parseTestResult, testCommandKind } from "../extensions/workflow-monitor/test-runner.ts";
import {
  debugWarning,
  getDebugViolationWarning,
  getTddViolationWarning,
  getVerificationViolationWarning,
  processWriteWarning,
  tddWarning,
  verificationWarning,
} from "../extensions/workflow-monitor/warnings.ts";
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

test("file heuristics classify source tests specs plans and docs", () => {
  assert.equal(isTestFile("src/foo.test.ts"), true);
  assert.equal(isTestFile("tests/foo.test.ts"), true);
  assert.equal(isSourceFile("src/foo.ts"), true);
  assert.equal(isSourceFile("src/foo.test.ts"), false);
  assert.equal(isSourceFile("README.md"), false);
  assert.equal(classifyPath("docs/specs/2026-04-26-widget-design.md"), "spec");
  assert.equal(classifyPath("docs/plans/2026-04-26-widget.md"), "plan");
  assert.equal(classifyPath("docs/plans/2026-04-26-widget-design.md"), "legacy-spec");
  assert.equal(classifyPath("README.md"), "doc");
  assert.equal(findCorrespondingTestFile("src/foo.ts"), "tests/foo.test.ts");
  assert.equal(findCorrespondingTestFile("lib/foo.js"), "test/foo.test.js");
});

test("test runner detection recognizes common test commands", () => {
  assert.equal(parseTestCommand("npm test"), true);
  assert.equal(parseTestCommand("pnpm test"), true);
  assert.equal(parseTestCommand("node --test tests/foo.test.ts"), true);
  assert.equal(parseTestCommand("cargo nextest"), true);
  assert.equal(parseTestCommand("cargo nextest run"), true);
  assert.equal(parseTestCommand("go test ./..."), true);
  assert.equal(parseTestCommand("rspec"), true);
  assert.equal(parseTestCommand("phpunit"), true);
  assert.equal(parseTestCommand("dotnet test"), true);
  assert.equal(parseTestCommand("mocha"), true);
  assert.equal(parseTestCommand("mise exec -- dotnet test"), true);
  assert.equal(parseTestCommand("git status"), false);
  assert.equal(testCommandKind("npm test"), "test");
  assert.equal(testCommandKind("npm run lint"), "verification");
  assert.equal(testCommandKind("npm run build"), "verification");
});

test("test runner detection recognizes mise test commands", () => {
  assert.equal(parseTestCommand("mise run test"), true);
  assert.equal(parseTestCommand("mise test"), true);
  assert.equal(parseTestCommand("mise exec -- npm test"), true);
  assert.equal(parseTestCommand("mise exec node@24 -- node --test tests/foo.test.ts"), true);
  assert.equal(parseTestCommand("mise exec -- git status"), false);
});

test("test result parser uses exit code first and output fallbacks", () => {
  assert.equal(parseTestResult("whatever", 0), true);
  assert.equal(parseTestResult("whatever", 1), false);
  assert.equal(parseTestResult("12 passing", null), true);
  assert.equal(parseTestResult("FAIL  tests/foo.test.ts", null), false);
});

test("warning messages expose specific workflow guardrails", () => {
  assert.match(processWriteWarning("src/index.ts"), /docs\/specs\/ and docs\/plans\//);
  assert.match(tddWarning("Write or update a failing test before changing source code."), /failing test/);
  assert.match(getTddViolationWarning("Write or update a failing test before changing source code."), /failing test/);
  assert.match(debugWarning("Investigate the root cause before changing source code."), /root cause/);
  assert.match(getDebugViolationWarning("Investigate the root cause before changing source code."), /root cause/);
  assert.match(
    verificationWarning({ type: "commit-without-verification", command: "git commit -m test" }),
    /fresh passing test\/verification command/,
  );
  assert.match(getVerificationViolationWarning({ type: "commit-without-verification", command: "git commit -m test" }), /fresh passing/);
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

test("workflow handler integrates tracker artifacts todo subagents and monitors", () => {
  const handler = createWorkflowHandler();

  handler.handleInputText("/skill:brainstorming");
  handler.handleFileWritten("docs/specs/2026-04-26-widget-design.md");
  assert.equal(handler.getFullState().workflow.artifacts.brainstorm, "docs/specs/2026-04-26-widget-design.md");

  handler.handleFileWritten("tests/widget.test.ts");
  handler.handleTestCommand("npm test", "1 failing", 1);
  assert.equal(handler.getFullState().tdd.status, "RED");

  handler.handleToolCall("todo", { action: "create", subject: "Implement widget" });
  assert.equal(handler.getFullState().workflow.currentPhase, "execute");

  handler.handleToolCall("subagent", { agent: "superpowers-code-reviewer", task: "Review" });
  assert.equal(handler.getFullState().workflow.currentPhase, "review");
});

test("workflow handler emits TDD debug and verification violations", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:executing-plans");

  assert.equal(handler.handleFileWritten("src/index.ts").violation?.type, "source-before-failing-test");
  handler.handleTestCommand("npm test", "FAIL", 1);
  handler.handleFileWritten("src/index.ts");
  handler.handleTestCommand("npm test", "FAIL", 1);
  assert.equal(handler.handleFileWritten("src/index.ts").violation?.type, "repeated-fix-failures");

  const tddFlow = createWorkflowHandler();
  tddFlow.handleFileWritten("tests/index.test.ts");
  tddFlow.handleTestCommand("npm test", "FAIL", 1);
  assert.equal(tddFlow.handleFileWritten("src/index.ts").violation, undefined);

  handler.handleTestCommand("npm test", "ok", 0);
  handler.handleFileWritten("src/index.ts");
  assert.equal(handler.checkCommitGate("git push")?.type, "push-without-verification");
});

test("workflow handler records tool result signals for todo, subagent, reads, search, and bash", () => {
  const handler = createWorkflowHandler();
  handler.handleToolResult("read", { path: "skills/requesting-code-review/SKILL.md" }, { content: "" });
  assert.equal(handler.getFullState().workflow.currentPhase, "review");
  handler.handleToolResult("read", { path: "src/index.ts" }, { content: "" });
  assert.equal(handler.getFullState().investigation.hasInvestigation, true);

  handler.handleToolResult("bash", { command: "rg failing src" }, { details: { exitCode: 0 }, content: "" });
  assert.equal(handler.getFullState().debug.hasInvestigation, true);

  handler.handleToolResult("todo", { action: "list" }, { details: { tasks: [{ status: "completed" }] } });
  assert.equal(handler.getFullState().workflow.phases.execute, "complete");
});

test("workflow handler uses bash output when exit code details are missing", () => {
  const handler = createWorkflowHandler();
  handler.handleFileWritten("src/index.ts");
  handler.handleToolResult("bash", { command: "npm test" }, { content: "FAIL tests/index.test.ts", isError: false });
  assert.equal(handler.getFullState().verification.status, "failed");
  assert.equal(handler.checkCommitGate("git commit -m test")?.type, "commit-without-verification");
});

test("workflow handler state is serializable and reconstructable", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:writing-plans");
  const snapshot = handler.getFullState();

  const restored = createWorkflowHandler();
  restored.setFullState(snapshot);

  assert.deepEqual(restored.getFullState(), snapshot);
});
