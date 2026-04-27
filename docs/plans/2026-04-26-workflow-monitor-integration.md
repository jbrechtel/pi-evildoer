# Workflow Monitor Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the contract in `docs/specs/2026-04-26-workflow-monitor-integration-design.md`: workflow-aware skills plus a runtime monitor that tracks workflow/TDD/debug/verification state, renders the TUI phase strip, and observes this package's current `todo` and `pi-subagents` tools.

**Architecture:** The skills define the observable workflow contract. The monitor observes Pi events and updates modular state machines for workflow, TDD, debugging, and verification. The extension renders a compact TUI widget and provides explicit `/workflow-reset` and `/workflow-next` commands. `todo` and `pi-subagents` remain companion-package responsibilities; the monitor only observes their tool calls/results.

**Tech Stack:** TypeScript Pi extension APIs, Node 24 built-in test runner with `--experimental-strip-types`, Pi TUI `Text` widgets, existing peer dependencies `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui`.

---

## Source contract

Implement against:

- Spec: `docs/specs/2026-04-26-workflow-monitor-integration-design.md`
- Current task tool: `todo` from `@juicesharp/rpiv-todo`
- Current subagent tool: `subagent` from `pi-subagents`
- Current reviewer agents:
  - `agents/superpowers-code-reviewer.md`
  - `agents/superpowers-spec-reviewer.md`

Do not port these plus-only components:

- `plan_tracker`
- `workflow_reference`
- `extensions/plan-tracker.ts`
- `extensions/subagent/**`
- plus `agents/**`
- plus skill files or review prompts as replacements

## File structure

### New files

- `extensions/workflow-monitor/tdd-monitor.ts`
- `extensions/workflow-monitor/debug-monitor.ts`
- `extensions/workflow-monitor/investigation.ts`
- `extensions/workflow-monitor/verification-monitor.ts`
- `tests/workflow-monitor-runtime.test.ts`
- `tests/workflow-monitor-extension.test.ts`

### Modified files

- `skills/brainstorming/SKILL.md`
- `skills/writing-plans/SKILL.md`
- `skills/executing-plans/SKILL.md`
- `skills/subagent-driven-development/SKILL.md`
- `skills/verification-before-completion/SKILL.md`
- `skills/requesting-code-review/SKILL.md`
- `skills/finishing-a-development-branch/SKILL.md`
- `skills/test-driven-development/SKILL.md`
- `skills/systematic-debugging/SKILL.md`
- `extensions/workflow-monitor.ts`
- `extensions/workflow-monitor/workflow-handler.ts`
- `extensions/workflow-monitor/workflow-tracker.ts`
- `extensions/workflow-monitor/workflow-transitions.ts`
- `extensions/workflow-monitor/warnings.ts`
- `extensions/workflow-monitor/skip-confirmation.ts`
- `extensions/workflow-monitor/heuristics.ts`
- `extensions/workflow-monitor/test-runner.ts`
- `tests/skills.test.ts`
- `tests/workflow-monitor.test.ts`
- `README.md`

## Task 1: Add skill contract tests and update skills

**Files:**
- Modify: `tests/skills.test.ts`
- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`
- Modify: `skills/executing-plans/SKILL.md`
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/verification-before-completion/SKILL.md`
- Modify: `skills/requesting-code-review/SKILL.md`
- Modify: `skills/finishing-a-development-branch/SKILL.md`
- Modify: `skills/test-driven-development/SKILL.md`
- Modify: `skills/systematic-debugging/SKILL.md`

- [ ] **Step 1: Add failing skill contract tests**

Append these tests to `tests/skills.test.ts`:

```ts
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

test("review verification finish TDD and debugging skills expose monitor contracts", () => {
  const verification = readSkill("verification-before-completion/SKILL.md");
  assert.match(verification, /source edit.*stale/i);
  assert.match(verification, /\/workflow-next review/);

  const review = readSkill("requesting-code-review/SKILL.md");
  assert.match(review, /agent:\s*"superpowers-code-reviewer"/);
  assert.match(review, /canonical review phase signal|review phase signal/i);
  assert.match(review, /\/workflow-next finish/);

  const finish = readSkill("finishing-a-development-branch/SKILL.md");
  assert.match(finish, /git commit/);
  assert.match(finish, /git push/);
  assert.match(finish, /gh pr create/);
  assert.match(finish, /\/workflow-reset/);

  const tdd = readSkill("test-driven-development/SKILL.md");
  assert.match(tdd, /RED-PENDING/);
  assert.match(tdd, /REFACTOR/);
  assert.match(tdd, /guardrails/i);

  const debugging = readSkill("systematic-debugging/SKILL.md");
  assert.match(debugging, /investigation activity/i);
  assert.match(debugging, /repeated fixes fail|repeated fix attempts/i);
});
```

- [ ] **Step 2: Run skill tests and verify they fail**

```bash
node --experimental-strip-types --test tests/skills.test.ts
```

Expected: FAIL because several skills do not yet mention the workflow monitor contract.

- [ ] **Step 3: Update `brainstorming` skill**

Add a concise monitor handoff note near the implementation transition section:

```md
**Workflow monitor handoff:** The runtime monitor recognises the written `docs/specs/*-design.md` file as the brainstorm artifact. For a fresh planning session, use `/workflow-next plan <spec-path>`.
```

Keep `docs/specs/YYYY-MM-DD-<topic>-design.md` as the required design path. Do not add `plan_tracker` or `workflow_reference`.

- [ ] **Step 4: Update `writing-plans` skill**

Near "Execution Handoff", add:

```md
**Workflow monitor handoff:** The runtime monitor recognises the saved `docs/plans/*.md` file as the plan artifact. For a fresh execution session, use `/workflow-next execute <plan-path>`.
```

Change execution handoff references from `superpowers:subagent-driven-development` / `superpowers:executing-plans` to explicit Pi invocations:

```md
- **REQUIRED SUB-SKILL:** Use `/skill:subagent-driven-development`
- **REQUIRED SUB-SKILL:** Use `/skill:executing-plans`
```

Do not add `plan_tracker` or `workflow_reference`.

- [ ] **Step 5: Update `executing-plans` skill**

In Step 1/Step 2, make the exact `todo` signal lifecycle visible:

```ts
todo({ action: "create", subject: "Implement Task N" })
todo({ action: "update", id: 1, status: "in_progress", activeForm: "implementing task N" })
todo({ action: "update", id: 1, status: "completed" })
```

Add:

```md
**Workflow monitor signals:** `todo.create` and `todo.update(... status: "in_progress")` tell the runtime monitor that execution has begun. Completed todos let the monitor infer execution progress. For a fresh verification session after all tasks pass, use `/workflow-next verify <plan-path>`.
```

Do not add `plan_tracker`.

- [ ] **Step 6: Update `subagent-driven-development` skill**

Near "Pi subagent Usage", add:

```md
**Workflow monitor signals:** The runtime monitor recognises `subagent({ agent: "worker" ... })` as execution work, `subagent({ agent: "superpowers-spec-reviewer" ... })` as per-task spec review during execution, and `subagent({ agent: "superpowers-code-reviewer" ... })` as code review. Keep these agent names exact.
```

Ensure examples still use exactly:

```ts
subagent({ agent: "worker", task: "...filled implementer prompt...", context: "fresh" })
subagent({ agent: "superpowers-spec-reviewer", task: "...filled spec review prompt...", context: "fresh" })
subagent({ agent: "superpowers-code-reviewer", task: "...filled code review prompt...", context: "fresh" })
```

Do not add plus-local `code-reviewer` / `spec-reviewer` as canonical names.

- [ ] **Step 7: Update verification, review, finish, TDD, and debugging skills**

Add concise monitor notes:

`verification-before-completion`:

```md
**Workflow monitor:** Passing verification commands refresh the runtime monitor's verification state. Any source edit after that makes verification stale again. After verification passes, `/workflow-next review` can start a fresh review session.
```

`requesting-code-review`:

```md
**Workflow monitor signal:** The runtime monitor recognises `subagent({ agent: "superpowers-code-reviewer" ... })` as the canonical review phase signal. Keep this agent name exact. After review completes, `/workflow-next finish` can start a fresh finishing session.
```

`finishing-a-development-branch`:

```md
**Workflow monitor gates:** `git commit`, `git push`, and `gh pr create` are gated by the runtime monitor when source edits have not been followed by fresh verification. Run the required verification before these actions. Use `/workflow-reset` when starting a new unrelated task.
```

`test-driven-development`:

```md
**Workflow monitor:** The runtime monitor tracks TDD state (`RED-PENDING`, `RED`, `GREEN`, `REFACTOR`) and warns on source-before-test patterns. These warnings are guardrails; follow this skill's process regardless of whether a warning appears.
```

`systematic-debugging`:

```md
**Workflow monitor:** The runtime monitor recognises investigation activity and warns when source fixes happen before investigation or when repeated fixes fail. These warnings are guardrails; complete this skill's debugging process regardless of whether a warning appears.
```

- [ ] **Step 8: Run skill tests**

```bash
node --experimental-strip-types --test tests/skills.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit skill contract updates**

```bash
git add tests/skills.test.ts skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md skills/executing-plans/SKILL.md skills/subagent-driven-development/SKILL.md skills/verification-before-completion/SKILL.md skills/requesting-code-review/SKILL.md skills/finishing-a-development-branch/SKILL.md skills/test-driven-development/SKILL.md skills/systematic-debugging/SKILL.md
git commit -m "feat: document workflow monitor skill contracts"
```

## Task 2: Add adapted workflow tracker state

**Files:**
- Create: `tests/workflow-monitor-runtime.test.ts`
- Modify: `extensions/workflow-monitor/workflow-tracker.ts`
- Modify: `tests/workflow-monitor.test.ts` if existing assertions need the new state shape.

- [ ] **Step 1: Create failing tracker contract tests**

Create `tests/workflow-monitor-runtime.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeBoundaryToPrompt,
  parseSkillName,
  SKILL_TO_PHASE,
  WorkflowTracker,
  WORKFLOW_PHASES,
} from "../extensions/workflow-monitor/workflow-tracker.ts";

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

test("tracker does not treat plus-local reviewer names as canonical review signals", () => {
  const tracker = new WorkflowTracker();
  assert.equal(tracker.onSubagentToolCall({ agent: "code-reviewer", task: "Review" }), false);
  assert.equal(tracker.getState().currentPhase, null);
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
```

- [ ] **Step 2: Run tracker tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

Expected: FAIL because the current tracker has a flat phase parser and lacks the full state machine.

- [ ] **Step 3: Implement the adapted tracker**

Replace `extensions/workflow-monitor/workflow-tracker.ts` with a full state machine that exports:

```ts
export const WORKFLOW_PHASES = ["brainstorm", "plan", "execute", "verify", "review", "finish"] as const;
export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];
export type Phase = WorkflowPhase;
export type PhaseStatus = "pending" | "active" | "complete" | "skipped";
export interface WorkflowTrackerState { /* phases/currentPhase/artifacts/prompted */ }
export type TransitionBoundary = "design_committed" | "plan_ready" | "execution_complete" | "verification_passed" | "review_complete";
export const SKILL_TO_PHASE: Record<string, WorkflowPhase>;
export function parseSkillName(text: string): string | null;
export function computeBoundaryToPrompt(state: WorkflowTrackerState): TransitionBoundary | null;
export class WorkflowTracker { /* methods used by tests */ }
```

Required path recognition:

```ts
/^docs\/specs\/.*-design\.md$/                    // brainstorm
/^docs\/plans\/.*-design\.md$/                    // legacy brainstorm
/^docs\/superpowers\/specs\/.*-design\.md$/       // compatibility brainstorm
/^docs\/plans\/[^/]+\.md$/ excluding *-design.md  // plan
/^docs\/superpowers\/plans\/[^/]+\.md$/           // compatibility plan
```

Required subagent recognition:

- `worker` → execute
- `superpowers-code-reviewer` → review
- `superpowers-spec-reviewer` → review-related, but do not force top-level review when current phase is execute
- `code-reviewer` / `spec-reviewer` → no canonical signal

Required todo recognition:

- `action: "create"` → execute
- `action: "update", status: "in_progress"` → execute
- result details with all non-deleted tasks `completed` → execute complete

- [ ] **Step 4: Run tracker tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

Expected: PASS for tracker tests.

- [ ] **Step 5: Update existing workflow tests for new state shape**

Run:

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

If old tests fail because `getFullState()` is no longer flat, update assertions to use `getFullState().workflow.currentPhase` and related nested fields. Keep equivalent coverage.

- [ ] **Step 6: Commit tracker work**

```bash
git add extensions/workflow-monitor/workflow-tracker.ts tests/workflow-monitor-runtime.test.ts tests/workflow-monitor.test.ts
git commit -m "feat: add workflow tracker contract"
```

## Task 3: Add TDD, debug, investigation, and verification monitors

**Files:**
- Create: `extensions/workflow-monitor/tdd-monitor.ts`
- Create: `extensions/workflow-monitor/debug-monitor.ts`
- Create: `extensions/workflow-monitor/investigation.ts`
- Create: `extensions/workflow-monitor/verification-monitor.ts`
- Modify: `tests/workflow-monitor-runtime.test.ts`

- [ ] **Step 1: Add failing pure monitor tests**

Append tests to `tests/workflow-monitor-runtime.test.ts`:

```ts
import { DebugMonitor } from "../extensions/workflow-monitor/debug-monitor.ts";
import { isInvestigationCommand, isInvestigationToolCall } from "../extensions/workflow-monitor/investigation.ts";
import { TddMonitor } from "../extensions/workflow-monitor/tdd-monitor.ts";
import { VerificationMonitor } from "../extensions/workflow-monitor/verification-monitor.ts";

test("TddMonitor tracks red-pending red green and refactor", () => {
  const monitor = new TddMonitor();
  assert.equal(monitor.getPhase(), "idle");
  assert.equal(monitor.onFileWritten("src/foo.ts")?.type, "source-before-test");
  assert.equal(monitor.onFileWritten("src/foo.test.ts"), null);
  assert.equal(monitor.getPhase(), "red-pending");
  monitor.onTestResult(false);
  assert.equal(monitor.getPhase(), "red");
  assert.equal(monitor.onFileWritten("src/foo.ts"), null);
  monitor.onTestResult(true);
  assert.equal(monitor.getPhase(), "green");
  monitor.onFileWritten("src/foo.ts");
  assert.equal(monitor.getPhase(), "refactor");
});

test("DebugMonitor warns on fixes before investigation and repeated failed fixes", () => {
  const monitor = new DebugMonitor();
  monitor.onTestFailed();
  assert.equal(monitor.isActive(), true);
  assert.equal(monitor.onSourceWritten("src/fix.ts")?.type, "fix-without-investigation");
  monitor.onInvestigation();
  assert.equal(monitor.onSourceWritten("src/fix.ts"), null);
  monitor.onSourceWritten("src/fix.ts");
  assert.equal(monitor.onSourceWritten("src/fix.ts")?.type, "excessive-fix-attempts");
});

test("investigation helpers recognise diagnostic commands and tools", () => {
  assert.equal(isInvestigationCommand("rg error src"), true);
  assert.equal(isInvestigationCommand("grep -R problem ."), true);
  assert.equal(isInvestigationCommand("git diff"), true);
  assert.equal(isInvestigationCommand("npm test"), false);
  assert.equal(isInvestigationToolCall("read", { path: "src/index.ts" }), true);
  assert.equal(isInvestigationToolCall("write", { path: "src/index.ts" }), false);
});

test("VerificationMonitor gates completion commands after source edits until verification passes", () => {
  const monitor = new VerificationMonitor();
  assert.equal(monitor.checkCommitGate("git commit -m test"), null);
  monitor.onSourceWritten();
  assert.equal(monitor.checkCommitGate("git commit -m test")?.type, "commit-without-verification");
  assert.equal(monitor.checkCommitGate("git push")?.type, "push-without-verification");
  assert.equal(monitor.checkCommitGate("gh pr create --title test")?.type, "pr-without-verification");
  monitor.recordVerification();
  assert.equal(monitor.checkCommitGate("git commit -m test"), null);
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

Expected: FAIL because the monitor modules do not exist.

- [ ] **Step 3: Create the pure modules**

Use `pi-superpowers-plus` as reference, but keep the resulting modules independent of plus logging, plus plan tracker, plus subagent extension, and plus reference tool.

Required public exports:

```ts
// tdd-monitor.ts
export type TddPhase = "idle" | "red-pending" | "red" | "green" | "refactor";
export interface TddViolation { type: "source-before-test" | "source-during-red"; file: string }
export class TddMonitor { /* getPhase/getState/setState/onFileWritten/onTestResult/onCommit */ }

// debug-monitor.ts
export type DebugViolationType = "fix-without-investigation" | "excessive-fix-attempts";
export interface DebugViolation { type: DebugViolationType; file: string; fixAttempts?: number }
export class DebugMonitor { /* getState/setState/isActive/onTestFailed/onInvestigation/onSourceWritten/onTestPassed/onCommit */ }

// investigation.ts
export function isInvestigationCommand(command: string): boolean;
export function isInvestigationToolCall(toolName: string, params?: Record<string, unknown>): boolean;

// verification-monitor.ts
export interface VerificationViolation { type: "commit-without-verification" | "push-without-verification" | "pr-without-verification"; command: string }
export class VerificationMonitor { /* getState/setState/onSourceWritten/recordVerification/reset/checkCommitGate */ }
```

- [ ] **Step 4: Run pure monitor tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

Expected: PASS for pure monitor tests.

- [ ] **Step 5: Commit pure monitors**

```bash
git add extensions/workflow-monitor/tdd-monitor.ts extensions/workflow-monitor/debug-monitor.ts extensions/workflow-monitor/investigation.ts extensions/workflow-monitor/verification-monitor.ts tests/workflow-monitor-runtime.test.ts
git commit -m "feat: add workflow runtime monitors"
```

## Task 4: Merge helper contracts for warnings, heuristics, and test parsing

**Files:**
- Modify: `extensions/workflow-monitor/warnings.ts`
- Modify: `extensions/workflow-monitor/heuristics.ts`
- Modify: `extensions/workflow-monitor/test-runner.ts`
- Modify: `tests/workflow-monitor-runtime.test.ts`

- [ ] **Step 1: Add failing helper tests**

Append:

```ts
import { findCorrespondingTestFile, isAllowedThinkingPhaseWrite } from "../extensions/workflow-monitor/heuristics.ts";
import { parseTestCommand, parseTestResult } from "../extensions/workflow-monitor/test-runner.ts";
import { getDebugViolationWarning, getTddViolationWarning, getVerificationViolationWarning } from "../extensions/workflow-monitor/warnings.ts";

test("thinking phase writes allow current spec and plan paths", () => {
  assert.equal(isAllowedThinkingPhaseWrite("docs/specs/x-design.md"), true);
  assert.equal(isAllowedThinkingPhaseWrite("docs/plans/x.md"), true);
  assert.equal(isAllowedThinkingPhaseWrite("src/index.ts"), false);
});

test("test runner detects mise wrapped verification commands", () => {
  assert.equal(parseTestCommand("mise run test"), true);
  assert.equal(parseTestCommand("mise test"), true);
  assert.equal(parseTestCommand("mise exec -- npm test"), true);
  assert.equal(parseTestCommand("mise exec node@24 -- node --test tests/foo.test.ts"), true);
  assert.equal(parseTestCommand("git status"), false);
  assert.equal(parseTestResult("ignored", 0), true);
  assert.equal(parseTestResult("ignored", 1), false);
});

test("warning helpers expose TDD debug and verification messages", () => {
  assert.match(getTddViolationWarning("source-before-test", "src/index.ts"), /TDD/i);
  assert.match(getDebugViolationWarning("fix-without-investigation", "src/index.ts", 0), /DEBUG/i);
  assert.match(getVerificationViolationWarning("commit-without-verification", "git commit -m test"), /verification/i);
});

test("heuristics can suggest corresponding test files", () => {
  assert.deepEqual(findCorrespondingTestFile("src/foo.ts").slice(0, 2), ["src/foo.test.ts", "src/foo.spec.ts"]);
});
```

- [ ] **Step 2: Run helper tests and verify they fail only for missing helper exports**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

- [ ] **Step 3: Update warnings**

`warnings.ts` must export:

```ts
getTddViolationWarning(type, file, phase?)
getDebugViolationWarning(type, file, fixAttempts)
getVerificationViolationWarning(type, command)
warningForViolation(violation)
```

`warningForViolation` remains for existing compatibility. Thinking-phase write warnings must mention:

```text
docs/specs/ and docs/plans/
```

- [ ] **Step 4: Update heuristics**

Keep current `isAllowedThinkingPhaseWrite`, `isTestFile`, and `isSourceFile` behaviour. Add `findCorrespondingTestFile(filePath: string): string[]`.

- [ ] **Step 5: Keep mise-aware test parsing**

Keep current `mise` support and exit-code-first parsing. Add plus command patterns only where they do not weaken current behaviour:

- `rspec`
- `phpunit`
- `dotnet test`
- `mocha`

- [ ] **Step 6: Run helper and existing workflow tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts tests/workflow-monitor.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit helper contracts**

```bash
git add extensions/workflow-monitor/warnings.ts extensions/workflow-monitor/heuristics.ts extensions/workflow-monitor/test-runner.ts tests/workflow-monitor-runtime.test.ts tests/workflow-monitor.test.ts
git commit -m "feat: merge workflow helper contracts"
```

## Task 5: Replace workflow handler with full state snapshot

**Files:**
- Modify: `extensions/workflow-monitor/workflow-handler.ts`
- Modify: `tests/workflow-monitor-runtime.test.ts`
- Modify: `tests/workflow-monitor.test.ts`

- [ ] **Step 1: Add failing handler tests**

Append:

```ts
import { createWorkflowHandler } from "../extensions/workflow-monitor/workflow-handler.ts";

test("workflow handler exposes full workflow tdd debug verification snapshot", () => {
  const handler = createWorkflowHandler();
  const state = handler.getFullState();
  assert.equal(state.workflow.currentPhase, null);
  assert.equal(state.tdd.phase, "idle");
  assert.equal(state.debug.active, false);
  assert.equal(state.verification.verified, false);
});

test("workflow handler routes file writes through verification TDD and workflow tracker", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:brainstorming");
  assert.equal(handler.handleFileWritten("docs/specs/x-design.md"), true);
  assert.equal(handler.getFullState().workflow.currentPhase, "brainstorm");

  handler.handleInputText("/skill:executing-plans");
  const result = handler.handleToolCall("write", { path: "src/index.ts" });
  assert.equal(result.violation?.type, "source-before-test");
});

test("workflow handler tracks todo and subagent tool calls", () => {
  const handler = createWorkflowHandler();
  assert.equal(handler.handleTodoToolCall({ action: "create", subject: "Task 1" }), true);
  assert.equal(handler.getFullState().workflow.currentPhase, "execute");
  assert.equal(handler.handleSubagentToolCall({ agent: "superpowers-code-reviewer", task: "Review" }), true);
  assert.equal(handler.getFullState().workflow.currentPhase, "review");
});

test("workflow handler records passing verification from bash result", () => {
  const handler = createWorkflowHandler();
  handler.handleToolCall("write", { path: "src/index.ts" });
  assert.equal(handler.checkCommitGate("git commit -m test")?.type, "commit-without-verification");
  handler.handleBashResult("npm test", "", 0);
  assert.equal(handler.checkCommitGate("git commit -m test"), null);
});

test("workflow handler full state is serializable and reconstructable", () => {
  const handler = createWorkflowHandler();
  handler.handleInputText("/skill:writing-plans");
  handler.handleToolCall("write", { path: "src/index.ts" });
  const snapshot = handler.getFullState();
  const restored = createWorkflowHandler();
  restored.setFullState(snapshot);
  assert.deepEqual(restored.getFullState(), snapshot);
});
```

- [ ] **Step 2: Run tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts
```

- [ ] **Step 3: Implement full handler**

`workflow-handler.ts` must expose a full snapshot:

```ts
interface SuperpowersStateSnapshot {
  workflow: WorkflowTrackerState;
  tdd: { phase: TddPhase; testFiles: string[]; sourceFiles: string[]; redVerificationPending: boolean };
  debug: { active: boolean; investigated: boolean; fixAttempts: number };
  verification: { verified: boolean; verificationWaived: boolean };
}
```

Required public methods:

```ts
handleToolCall(toolName, input)
handleReadOrInvestigation(toolName, path)
handleBashResult(command, output, exitCode)
handleBashInvestigation(command)
isDebugActive()
getDebugFixAttempts()
getTddPhase()
getWidgetText()
getTddState()
checkCommitGate(command)
recordVerificationWaiver()
restoreTddState(...)
handleInputText(text)
handleFileWritten(path)
handleTodoToolCall(input)
handleTodoToolResult(details)
handleSubagentToolCall(input)
getWorkflowState()
getFullState()
setFullState(snapshot)
markWorkflowPrompted(phase)
completeCurrentWorkflowPhase()
advanceWorkflowTo(phase)
skipWorkflowPhases(phases)
handleSkillFileRead(path)
resetState()
```

Rules:

- source writes update verification, TDD, debug, and workflow state as applicable
- debug violations take precedence over TDD violations when debug mode is active
- passing tests refresh verification
- failing tests clear verification and may activate debug after repeated failures outside TDD red flow
- `todo` and `subagent` signals only update workflow state

- [ ] **Step 4: Update old tests for nested state**

Run:

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

Update old flat-state assertions to nested state assertions without deleting coverage.

- [ ] **Step 5: Run handler tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor-runtime.test.ts tests/workflow-monitor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit handler**

```bash
git add extensions/workflow-monitor/workflow-handler.ts tests/workflow-monitor-runtime.test.ts tests/workflow-monitor.test.ts
git commit -m "feat: integrate workflow monitor state machines"
```

## Task 6: Wire the extension, widget, commands, and runtime gates

**Files:**
- Modify: `extensions/workflow-monitor.ts`
- Modify: `extensions/workflow-monitor/workflow-transitions.ts`
- Modify: `extensions/workflow-monitor/skip-confirmation.ts`
- Create: `tests/workflow-monitor-extension.test.ts`

- [ ] **Step 1: Add failing extension tests**

Create `tests/workflow-monitor-extension.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import workflowMonitorExtension from "../extensions/workflow-monitor.ts";

function createFakePi() {
  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, any>();
  const entries: Array<{ customType: string; data: unknown }> = [];
  const api = {
    on(event: string, handler: Function) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand(name: string, opts: any) {
      commands.set(name, opts);
    },
    registerTool(tool: any) {
      throw new Error(`workflow monitor should not register tool ${tool.name}`);
    },
    appendEntry(customType: string, data: unknown) {
      entries.push({ customType, data });
    },
  };
  return { api, handlers, commands, entries };
}

function firstHandler(fake: ReturnType<typeof createFakePi>, event: string) {
  const handler = fake.handlers.get(event)?.[0];
  assert.ok(handler, `missing ${event} handler`);
  return handler;
}

function createCtx(overrides: Record<string, unknown> = {}) {
  let widget: any;
  const editorTexts: string[] = [];
  const notifications: Array<[string, string | undefined]> = [];
  const ctx: any = {
    hasUI: true,
    cwd: process.cwd(),
    sessionManager: { getBranch: () => [], getEntries: () => [], getSessionFile: () => "/tmp/session.jsonl" },
    ui: {
      setWidget: (_id: string, value: any) => { widget = value; },
      setEditorText: (text: string) => editorTexts.push(text),
      notify: (message: string, level?: string) => notifications.push([message, level]),
      select: async (_title: string, options: string[]) => options[0],
    },
    newSession: async (opts: any) => {
      if (opts?.withSession) await opts.withSession(ctx);
      return { cancelled: false };
    },
    ...overrides,
  };
  return { ctx, get widget() { return widget; }, editorTexts, notifications };
}

test("workflow monitor registers reset and workflow-next commands but no workflow_reference tool", () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  assert.equal(fake.commands.has("workflow-reset"), true);
  assert.equal(fake.commands.has("workflow-next"), true);
});

test("workflow widget renders phase strip", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await firstHandler(fake, "session_start")({ reason: "startup" }, harness.ctx);
  await firstHandler(fake, "input")({ source: "user", text: "/skill:writing-plans" }, harness.ctx);
  const rendered = harness.widget(null, { fg: (_c: string, s: string) => s, bold: (s: string) => s });
  const lines = rendered.render ? rendered.render(120) : [String(rendered.text ?? rendered)];
  assert.match(lines.join("\n"), /\[plan\]/);
});

test("workflow-next prefills current skill handoff text", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await fake.commands.get("workflow-next").handler("plan docs/specs/2026-04-26-x-design.md", harness.ctx);
  assert.match(harness.editorTexts[0], /Continue from artifact: docs\/specs\/2026-04-26-x-design\.md/);
  assert.match(harness.editorTexts[0], /\/skill:writing-plans/);
});

test("workflow-reset persists reset full state", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await fake.commands.get("workflow-reset").handler("", harness.ctx);
  const last = fake.entries.at(-1)!.data as any;
  assert.equal(last.workflow.currentPhase, null);
  assert.equal(last.tdd.phase, "idle");
  assert.equal(last.debug.active, false);
});

test("workflow monitor observes todo and subagent calls", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await firstHandler(fake, "session_start")({ reason: "startup" }, harness.ctx);
  await firstHandler(fake, "tool_call")({ toolCallId: "todo1", toolName: "todo", input: { action: "create", subject: "Task 1" } }, harness.ctx);
  await firstHandler(fake, "tool_call")({ toolCallId: "sub1", toolName: "subagent", input: { agent: "superpowers-code-reviewer", task: "Review" } }, harness.ctx);
  const last = fake.entries.at(-1)!.data as any;
  assert.equal(last.workflow.currentPhase, "review");
});
```

- [ ] **Step 2: Run extension tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor-extension.test.ts
```

Expected: FAIL because current extension wiring is still thin.

- [ ] **Step 3: Update workflow transitions**

`workflow-transitions.ts` must build `/workflow-next` text using current skill names:

```text
brainstorm → /skill:brainstorming
plan → /skill:writing-plans
execute → /skill:subagent-driven-development or /skill:executing-plans
verify → /skill:verification-before-completion
review → /skill:requesting-code-review
finish → /skill:finishing-a-development-branch
```

If an artifact is provided, prefill includes:

```text
Continue from artifact: <artifact>
```

No output mentions `plan_tracker`, plus agents, or `workflow_reference`.

- [ ] **Step 4: Update skip confirmation helper**

`skip-confirmation.ts` exports pure helpers. `active` phases are not unresolved; only `pending` phases are unresolved.

- [ ] **Step 5: Replace extension wiring**

`workflow-monitor.ts` must:

- reconstruct state on `session_start`, `session_tree`, and `session_compact`
- persist state to session custom entries after changes
- observe `input` for skill signals
- observe `tool_call` for bash/write/edit/todo/subagent signals and gates
- observe `tool_result` for warning injection and bash/todo results
- render widget key `pi-superpowers-workflow`
- register `/workflow-reset`
- register `/workflow-next`
- not register `workflow_reference`
- not write `.pi/superpowers-state.json` in this initial integration
- not auto-show plus-style `agent_end` boundary prompts

- [ ] **Step 6: Run extension tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor-extension.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit extension wiring**

```bash
git add extensions/workflow-monitor.ts extensions/workflow-monitor/workflow-transitions.ts extensions/workflow-monitor/skip-confirmation.ts tests/workflow-monitor-extension.test.ts
git commit -m "feat: wire workflow monitor extension"
```

## Task 7: Add runtime guardrail regression tests

**Files:**
- Modify: `tests/workflow-monitor-extension.test.ts`
- Modify: `extensions/workflow-monitor.ts` if tests reveal missing behaviour.

- [ ] **Step 1: Add thinking-phase write test**

Append:

```ts
test("brainstorm phase allows docs paths but blocks source writes", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await firstHandler(fake, "session_start")({ reason: "startup" }, harness.ctx);
  await firstHandler(fake, "input")({ source: "user", text: "/skill:brainstorming" }, harness.ctx);

  const allowed = await firstHandler(fake, "tool_call")({ toolCallId: "s1", toolName: "write", input: { path: "docs/specs/x-design.md" } }, harness.ctx);
  assert.equal(allowed?.block ?? allowed?.blocked ?? false, false);

  const blocked = await firstHandler(fake, "tool_call")({ toolCallId: "s2", toolName: "write", input: { path: "src/index.ts" } }, harness.ctx);
  assert.equal(blocked?.block ?? blocked?.blocked, true);
  assert.match(String(blocked?.reason ?? ""), /docs\/specs\/ and docs\/plans\//);
});
```

- [ ] **Step 2: Add verification gate test**

Append:

```ts
test("commit is gated after source write until verification passes", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await firstHandler(fake, "session_start")({ reason: "startup" }, harness.ctx);
  await firstHandler(fake, "input")({ source: "user", text: "/skill:executing-plans" }, harness.ctx);
  await firstHandler(fake, "tool_call")({ toolCallId: "w1", toolName: "write", input: { path: "src/index.ts" } }, harness.ctx);
  await firstHandler(fake, "tool_result")({ toolCallId: "w1", toolName: "write", input: { path: "src/index.ts" }, content: [], details: {}, isError: false }, harness.ctx);

  const blocked = await firstHandler(fake, "tool_call")({ toolCallId: "c1", toolName: "bash", input: { command: "git commit -m test" } }, harness.ctx);
  assert.equal(blocked?.block ?? blocked?.blocked, true);

  await firstHandler(fake, "tool_result")({
    toolCallId: "t1",
    toolName: "bash",
    input: { command: "npm test" },
    content: [{ type: "text", text: "" }],
    details: { exitCode: 0 },
    isError: false,
  }, harness.ctx);

  const allowed = await firstHandler(fake, "tool_call")({ toolCallId: "c2", toolName: "bash", input: { command: "git commit -m test" } }, harness.ctx);
  assert.equal(allowed?.block ?? allowed?.blocked ?? false, false);
});
```

- [ ] **Step 3: Add forbidden plus signal tests**

Append:

```ts
test("workflow monitor does not treat plus-local reviewer names as canonical review", async () => {
  const fake = createFakePi();
  workflowMonitorExtension(fake.api as any);
  const harness = createCtx();
  await firstHandler(fake, "session_start")({ reason: "startup" }, harness.ctx);
  await firstHandler(fake, "tool_call")({ toolCallId: "sub1", toolName: "subagent", input: { agent: "code-reviewer", task: "Review" } }, harness.ctx);
  const last = fake.entries.at(-1)?.data as any;
  assert.notEqual(last?.workflow?.currentPhase, "review");
});
```

- [ ] **Step 4: Run extension tests and fix runtime gates**

```bash
node --experimental-strip-types --test tests/workflow-monitor-extension.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit guardrail coverage**

```bash
git add extensions/workflow-monitor.ts tests/workflow-monitor-extension.test.ts
git commit -m "test: cover workflow monitor guardrails"
```

## Task 8: Update README and package documentation

**Files:**
- Modify: `README.md`
- Modify: `tests/readme.test.ts` if needed.

- [ ] **Step 1: Add workflow monitor runtime section to README**

Add a concise section documenting:

- phase strip widget
- TDD/debug/verification guardrails
- branch safety reminders
- `/workflow-reset`
- `/workflow-next <phase> [artifact]`
- `todo` and `subagent` remain companion package responsibilities

The README must not instruct users to use `plan_tracker` or `workflow_reference`.

- [ ] **Step 2: Add/update README tests**

If `tests/readme.test.ts` does not already cover it, add assertions that README mentions:

- `/workflow-reset`
- `/workflow-next`
- `todo` companion package
- `pi-subagents` companion package

and does not mention operational `plan_tracker` or `workflow_reference` instructions.

- [ ] **Step 3: Run README tests**

```bash
node --experimental-strip-types --test tests/readme.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit README docs**

```bash
git add README.md tests/readme.test.ts
git commit -m "docs: document workflow monitor runtime"
```

## Task 9: Final verification and review

**Files:**
- No planned changes except fixes from verification/review.

- [ ] **Step 1: Run complete test suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Search for forbidden runtime/content references**

```bash
rg -n "plan_tracker|workflow_reference|extensions/subagent|extensions/plan-tracker|agent:\s*\"code-reviewer\"|agent:\s*\"spec-reviewer\"" extensions skills agents README.md tests
```

Expected:

- no `plan_tracker` in skills, runtime code, README, or tests except negative assertions
- no `workflow_reference` in skills, runtime code, README, or tests except negative assertions
- no plus subagent or plan tracker extension references
- no plus-local `code-reviewer` / `spec-reviewer` as canonical positive examples

- [ ] **Step 3: Check spec coverage manually**

Read `docs/specs/2026-04-26-workflow-monitor-integration-design.md` and verify every acceptance criterion has either:

- a test assertion, or
- explicit README/skill text coverage.

If a criterion lacks coverage, add the missing test or documentation before proceeding.

- [ ] **Step 4: Request code review**

Use the current read-only reviewer contract:

```ts
subagent({
  agent: "superpowers-code-reviewer",
  task: "Review the workflow monitor integration against docs/specs/2026-04-26-workflow-monitor-integration-design.md and docs/plans/2026-04-26-workflow-monitor-integration.md. Check that the implementation satisfies the skill contracts and runtime contracts, uses current todo/pi-subagents integrations, and does not port plus plan_tracker, workflow_reference, agents, subagent extension, or skills.",
  context: "fresh"
})
```

Expected: no Critical or Important issues. Fix any Critical/Important issues and rerun `npm test`.

- [ ] **Step 5: Final verification before completion claim**

```bash
npm test
rg -n "plan_tracker|workflow_reference|extensions/subagent|extensions/plan-tracker" extensions skills README.md tests
```

Expected: tests pass and grep has no runtime/skill/README matches except deliberate negative assertions in tests.

- [ ] **Step 6: Commit final fixes if needed**

If review or verification required changes:

```bash
git add extensions/workflow-monitor.ts extensions/workflow-monitor/*.ts skills/*/SKILL.md tests/*.test.ts README.md docs/specs/2026-04-26-workflow-monitor-integration-design.md docs/plans/2026-04-26-workflow-monitor-integration.md
git commit -m "fix: address workflow monitor review findings"
```

If no changes were required, do not create an empty commit.

## Self-review

- Spec coverage: Plan tasks cover every acceptance criterion in `docs/specs/2026-04-26-workflow-monitor-integration-design.md`.
- Skill contract coverage: Task 1 updates and tests every skill named in the spec.
- Runtime contract coverage: Tasks 2-7 implement and test tracker, monitors, handler, extension wiring, widget, commands, and gates.
- Non-goal coverage: Plan includes grep checks and negative tests for plus-only components.
- Placeholder scan: No unresolved placeholders remain.
