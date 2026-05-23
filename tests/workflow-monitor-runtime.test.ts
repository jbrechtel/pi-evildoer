import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeBoundaryToPrompt,
  parseSkillName,
  SKILL_TO_PHASE,
  WorkflowTracker,
  WORKFLOW_PHASES,
} from "../extensions/workflow-monitor/workflow-tracker.ts";
import {
  createDebugState,
  nextDebugState,
  debugWarningsForEvent,
} from "../extensions/workflow-monitor/debug-monitor.ts";
import {
  createInvestigationState,
  nextInvestigationState,
} from "../extensions/workflow-monitor/investigation.ts";
import {
  createVerificationState,
  nextVerificationState,
  verificationWarningsForEvent,
} from "../extensions/workflow-monitor/verification-monitor.ts";
import { unresolvedPhasesBefore } from "../extensions/workflow-monitor/skip-confirmation.ts";

test("workflow tracker exposes the canonical phase contract", () => {
  assert.deepEqual(WORKFLOW_PHASES, ["brainstorm", "plan", "execute", "verify", "review", "finish"]);
  assert.equal(SKILL_TO_PHASE.brainstorming, "brainstorm");
  assert.equal(SKILL_TO_PHASE["writing-plans"], "plan");
  assert.equal(SKILL_TO_PHASE["subagent-driven-development"], "execute");
  assert.equal(SKILL_TO_PHASE["requesting-code-review"], "review");
});

test("parseSkillName recognises slash, superpowers, skill, and XML skill forms", () => {
  assert.equal(parseSkillName("/skill:writing-plans"), "writing-plans");
  assert.equal(parseSkillName("Use superpowers:verification-before-completion"), "verification-before-completion");
  assert.equal(parseSkillName("Use skill:requesting-code-review"), "requesting-code-review");
  assert.equal(parseSkillName('<skill name="brainstorming" location="/x">'), "brainstorming");
});

test("tracker detects design artifacts under docs/specs", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onFileWritten("docs/specs/2026-04-26-widget-design.md"), true);
  const state = tracker.getState();
  assert.equal(state.currentPhase, "brainstorm");
  assert.equal(state.artifacts.brainstorm, "docs/specs/2026-04-26-widget-design.md");
});

test("tracker detects implementation plan artifacts under docs/plans", () => {
  const tracker = new WorkflowTracker();
  tracker.advanceTo("brainstorm");
  assert.equal(tracker.onFileWritten("docs/plans/2026-04-26-workflow-monitor-integration.md"), true);
  const state = tracker.getState();
  assert.equal(state.currentPhase, "plan");
  assert.equal(state.artifacts.plan, "docs/plans/2026-04-26-workflow-monitor-integration.md");
  assert.equal(state.phases.brainstorm, "complete");
});

test("tracker supports plus compatibility artifact paths without changing canonical paths", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onFileWritten("docs/plans/2026-02-10-legacy-design.md"), true);
  assert.equal(tracker.getState().artifacts.brainstorm, "docs/plans/2026-02-10-legacy-design.md");

  const second = new WorkflowTracker();
  assert.equal(second.onFileWritten("docs/superpowers/specs/2026-02-10-x-design.md"), true);
  assert.equal(second.getState().currentPhase, "brainstorm");

  const third = new WorkflowTracker();
  assert.equal(third.onFileWritten("docs/superpowers/plans/2026-02-10-x.md"), true);
  assert.equal(third.getState().currentPhase, "plan");
});

test("tracker treats todo activity as execution signal", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onTodoToolCall({ action: "create", subject: "Implement Task 1" }), true);
  assert.equal(tracker.getState().currentPhase, "execute");
});

test("tracker can infer execution complete from todo result details", () => {
  const tracker = new WorkflowTracker();
  tracker.advanceTo("execute");
  assert.equal(
    tracker.onTodoToolResult({
      tasks: [
        { id: 1, subject: "Task 1", status: "completed" },
        { id: 2, subject: "Task 2", status: "completed" },
      ],
    }),
    true,
  );
  assert.equal(tracker.getState().phases.execute, "complete");
});

test("tracker treats pi-subagents worker and reviewer calls as workflow signals", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onSubagentToolCall({ agent: "worker", task: "Implement Task 1" }), true);
  assert.equal(tracker.getState().currentPhase, "execute");
  assert.equal(tracker.onSubagentToolCall({ agent: "superpowers-code-reviewer", task: "Review Task 1" }), true);
  assert.equal(tracker.getState().currentPhase, "review");
});

test("tracker handles exact pi-subagents review signals without fuzzy matches", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onSubagentToolCall({ agent: "code-reviewer", task: "Review" }), false);
  assert.equal(tracker.onSubagentToolCall({ agent: "feature-implementer", task: "Implement" }), false);
  assert.equal(tracker.onSubagentToolCall({ agent: "superpowers-spec-reviewer", task: "Review task" }), true);
  assert.equal(tracker.getState().currentPhase, "execute");
});

test("tracker recognises skill file reads and backticked skill mentions", () => {
  const tracker = new WorkflowTracker();
  assert.equal(parseSkillName("Use `/skill:writing-plans` next"), "writing-plans");
  assert.equal(tracker.onSkillFileRead("skills/requesting-code-review/SKILL.md"), true);
  assert.equal(tracker.getState().currentPhase, "review");
});

test("tracker computes boundaries and resets on backward navigation", () => {
  const tracker = new WorkflowTracker();
  tracker.advanceTo("brainstorm");
  tracker.completeCurrent();
  assert.equal(computeBoundaryToPrompt(tracker.getState()), "design_committed");
  tracker.markPrompted("brainstorm");
  assert.equal(computeBoundaryToPrompt(tracker.getState()), null);

  tracker.advanceTo("plan");
  tracker.recordArtifact("plan", "docs/plans/old.md");
  tracker.advanceTo("brainstorm");
  const state = tracker.getState();
  assert.equal(state.currentPhase, "brainstorm");
  assert.equal(state.phases.plan, "pending");
  assert.equal(state.artifacts.plan, null);
});

test("tracker preserves new artifacts when file writes move backward", () => {
  const tracker = new WorkflowTracker();
  tracker.advanceTo("execute");
  tracker.recordArtifact("plan", "docs/plans/old.md");
  assert.equal(tracker.onFileWritten("docs/specs/new-design.md"), true);
  assert.equal(tracker.getState().currentPhase, "brainstorm");
  assert.equal(tracker.getState().artifacts.brainstorm, "docs/specs/new-design.md");

  tracker.advanceTo("review");
  assert.equal(tracker.onFileWritten("docs/plans/new-plan.md"), true);
  assert.equal(tracker.getState().currentPhase, "plan");
  assert.equal(tracker.getState().artifacts.plan, "docs/plans/new-plan.md");
});

test("skip confirmation treats the current phase as resolved", () => {
  assert.deepEqual(unresolvedPhasesBefore("execute", { currentPhase: "plan", completedPhases: ["brainstorm"] }), []);
});

test("debug and investigation monitors warn on fixes before investigation and repeated failed fixes", () => {
  let investigation = createInvestigationState();
  investigation = nextInvestigationState(investigation, { kind: "read", path: "src/widget.ts" });
  investigation = nextInvestigationState(investigation, { kind: "search", pattern: "throw" });
  assert.equal(investigation.hasInvestigation, true);

  let debug = createDebugState();
  assert.deepEqual(debugWarningsForEvent(debug, { kind: "source-write", path: "src/widget.ts" }), [
    "Investigate the root cause before changing source code.",
  ]);
  debug = nextDebugState(debug, { kind: "source-write", path: "src/widget.ts" });
  debug = nextDebugState(debug, { kind: "test-run", exitCode: 1, command: "npm test" });
  debug = nextDebugState(debug, { kind: "source-write", path: "src/widget.ts" });
  debug = nextDebugState(debug, { kind: "test-run", exitCode: 1, command: "npm test" });
  assert.deepEqual(debugWarningsForEvent(debug, { kind: "source-write", path: "src/widget.ts" }), [
    "Repeated fixes are failing; stop and re-investigate the root cause.",
  ]);
});

test("verification monitor only gates commits pushes and PRs after source edits", () => {
  let state = createVerificationState();
  assert.deepEqual(verificationWarningsForEvent(state, { kind: "command", command: "git commit -m x" }), []);

  state = nextVerificationState(state, { kind: "source-write", path: "src/widget.ts" });
  assert.equal(state.status, "stale");
  assert.deepEqual(verificationWarningsForEvent(state, { kind: "command", command: "git commit -m x" }), [
    "Run fresh verification before git commit.",
  ]);

  state = nextVerificationState(state, { kind: "test-run", command: "npm test", exitCode: 0 });
  assert.equal(state.status, "fresh");
  assert.deepEqual(verificationWarningsForEvent(state, { kind: "command", command: "git push" }), []);

  state = nextVerificationState(state, { kind: "source-write", path: "src/widget.ts" });
  assert.deepEqual(verificationWarningsForEvent(state, { kind: "command", command: "git push" }), [
    "Run fresh verification before git push.",
  ]);
  assert.deepEqual(verificationWarningsForEvent(state, { kind: "command", command: "gh pr create" }), [
    "Run fresh verification before gh pr create.",
  ]);
});
