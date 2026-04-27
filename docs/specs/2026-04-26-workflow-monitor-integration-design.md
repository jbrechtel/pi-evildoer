# Workflow Monitor Integration Specification

**Date:** 2026-04-26
**Status:** Draft

## Purpose

`pi-superpowers` must provide the useful runtime workflow oversight from `pi-superpowers-plus` while preserving this package's current `obra/superpowers`-derived skills and Pi-native companion tools.

The final package must have a coherent contract between three surfaces:

1. **Skills** — describe the workflow and produce observable artifacts/tool usage.
2. **Runtime monitor** — observes Pi events and maintains workflow/TDD/debug/verification state.
3. **TUI/commands** — expose state and explicit handoff/reset actions to the user.

## Non-goals

The package must not include or depend on these `pi-superpowers-plus` components:

- `plan_tracker`
- plus `extensions/plan-tracker.ts`
- plus `extensions/subagent/**`
- plus `agents/**`
- plus skills as replacements for current skills
- plus review prompt templates as replacements for current review prompts
- `workflow_reference`

Task tracking remains owned by `todo` from `@juicesharp/rpiv-todo`. Subagent execution remains owned by `subagent` from `pi-subagents`.

## Workflow phases

The runtime workflow has exactly these phases, in order:

```text
brainstorm → plan → execute → verify → review → finish
```

Each phase has one status:

```ts
type PhaseStatus = "pending" | "active" | "complete" | "skipped";
```

The monitor tracks phase status, current phase, phase artifacts, and whether an optional boundary prompt has already been shown:

```ts
interface WorkflowTrackerState {
  phases: Record<WorkflowPhase, PhaseStatus>;
  currentPhase: WorkflowPhase | null;
  artifacts: Record<WorkflowPhase, string | null>;
  prompted: Record<WorkflowPhase, boolean>;
}
```

The initial integration must not automatically show plus-style boundary prompts. The `prompted` field exists for future compatibility.

## Skill contract

The skills must expose monitor-compatible workflow signals. This section defines the required final behaviour of each skill, not how to edit the files.

### Brainstorming

`skills/brainstorming/SKILL.md` must define brainstorm output as a design/specification artifact at:

```text
docs/specs/YYYY-MM-DD-<topic>-design.md
```

The brainstorm phase is complete when the design artifact is written, self-reviewed, approved by the user, and committed according to the skill.

The skill must transition to implementation planning through `writing-plans`. It may offer an explicit fresh-session handoff using:

```text
/workflow-next plan <spec-path>
```

The brainstorming skill must not refer to `plan_tracker` or `workflow_reference`.

### Writing plans

`skills/writing-plans/SKILL.md` must define planning output as an implementation plan artifact at:

```text
docs/plans/YYYY-MM-DD-<feature-name>.md
```

The plan artifact is the input to execution. The skill must continue to offer the current two execution modes:

- `/skill:subagent-driven-development`
- `/skill:executing-plans`

It may offer an explicit fresh-session handoff using:

```text
/workflow-next execute <plan-path>
```

The writing-plans skill must not refer to `plan_tracker` or `workflow_reference`.

### Executing plans

`skills/executing-plans/SKILL.md` must use the `todo` tool for task state.

Observable execution signals are:

- creation of todos for plan tasks
- exactly one task marked `in_progress` before work begins on that task
- tasks marked `completed` only after their required verification passes

The skill must not use `plan_tracker`.

When all plan tasks are complete, the skill must transition toward verification and finishing according to the existing Superpowers workflow. It may use:

```text
/workflow-next verify <plan-path>
```

for an explicit fresh-session verification handoff.

### Subagent-driven development

`skills/subagent-driven-development/SKILL.md` must use `todo` for controller-visible task state and `subagent` from `pi-subagents` for delegated work.

The canonical subagent names are:

| Purpose | Agent name |
|---|---|
| implementation work | `worker` |
| spec compliance review | `superpowers-spec-reviewer` |
| code quality review | `superpowers-code-reviewer` |

These names are part of the runtime contract. The monitor uses them to distinguish execution from review.

Per-task `superpowers-spec-reviewer` calls are part of execution quality gates. `superpowers-code-reviewer` calls are review signals, especially for final or explicit code review.

The skill must not use plus-local agent names as canonical names. It must not use `plan_tracker` or `workflow_reference`.

### Verification before completion

`skills/verification-before-completion/SKILL.md` must require fresh verification evidence before any completion claim or shipping action.

A passing verification command refreshes monitor verification state. Any source edit after that makes verification stale again.

After successful verification, the workflow may continue to review with:

```text
/workflow-next review
```

The skill must not refer to `workflow_reference`.

### Requesting code review

`skills/requesting-code-review/SKILL.md` must use the read-only reviewer contract:

```ts
subagent({
  agent: "superpowers-code-reviewer",
  task: "...filled code-reviewer.md template...",
  context: "fresh"
})
```

The exact agent name `superpowers-code-reviewer` is part of the runtime contract and marks canonical code review.

The skill must continue to forbid the builtin editable `reviewer` agent for canonical Superpowers review.

After review is complete, the workflow may continue to finishing with:

```text
/workflow-next finish
```

The current review prompt/template remains canonical. The plus review prompt must not replace it.

### Finishing a development branch

`skills/finishing-a-development-branch/SKILL.md` must treat these commands as monitored completion actions:

- `git commit`
- `git push`
- `gh pr create`

Those actions require fresh verification after source edits.

When a task/workflow is finished and the user starts unrelated work, `/workflow-reset` clears monitor state.

### Test-driven development

`skills/test-driven-development/SKILL.md` must remain the canonical TDD process.

The runtime monitor tracks TDD state and warns on source-before-test patterns. Those warnings are guardrails; they do not replace the skill's process.

The skill must not depend on `workflow_reference`.

### Systematic debugging

`skills/systematic-debugging/SKILL.md` must remain the canonical debugging process.

The runtime monitor detects investigation activity and repeated fix attempts. Those warnings are guardrails; they do not replace the skill's process.

The skill must not depend on `workflow_reference`.

## Monitor signal contract

The runtime monitor must recognise the skill contract above through Pi input, tool-call, and tool-result events.

### Skill signals

The monitor recognises these skill references:

- `/skill:<name>`
- `skill:<name>`
- `superpowers:<name>`
- XML-style `<skill name="<name>">`
- reading a matching `skills/<name>/SKILL.md` file

Skill-to-phase mapping is:

| Skill | Phase |
|---|---|
| `brainstorming` | `brainstorm` |
| `writing-plans` | `plan` |
| `executing-plans` | `execute` |
| `subagent-driven-development` | `execute` |
| `verification-before-completion` | `verify` |
| `requesting-code-review` | `review` |
| `finishing-a-development-branch` | `finish` |

### Artifact signals

The monitor treats these paths as workflow artifacts:

| Path | Artifact phase |
|---|---|
| `docs/specs/*-design.md` | `brainstorm` |
| `docs/plans/*.md`, excluding `*-design.md` | `plan` |

Compatibility paths may also be recognised:

| Path | Artifact phase |
|---|---|
| `docs/plans/*-design.md` | `brainstorm` |
| `docs/superpowers/specs/*-design.md` | `brainstorm` |
| `docs/superpowers/plans/*.md` | `plan` |

Compatibility recognition must not change skill instructions away from `docs/specs` and `docs/plans`.

### Todo signals

The monitor treats `todo` calls as execution signals when they create or start work:

- `todo({ action: "create", ... })`
- `todo({ action: "update", status: "in_progress", ... })`

The monitor may infer execution completion only from `todo` result details when all non-deleted tasks are `completed` and at least one non-deleted task exists.

### Subagent signals

The monitor treats `subagent` calls as workflow signals according to exact agent name:

| Agent | Signal |
|---|---|
| `worker` | execution |
| `superpowers-spec-reviewer` | per-task/spec review within execution |
| `superpowers-code-reviewer` | code review |

Unknown agent names must not be interpreted as canonical review signals.

### Verification signals

A passing verification command refreshes verification state. A failing verification command clears fresh verification.

Recognised verification commands include:

- `node --test`
- `npm test`
- `npm run test`
- `pnpm test`
- `yarn test`
- `vitest`
- `jest`
- `pytest`
- `cargo test`
- `cargo nextest`
- `go test`
- `mise run test`
- `mise test`
- `mise exec -- <verification command>`

Exit code is authoritative when available.

## Guardrail contract

The monitor must enforce or warn on these runtime conditions.

### Thinking-phase writes

During `brainstorm` and `plan`, source writes outside these directories are process violations:

- `docs/specs/`
- `docs/plans/`

### TDD discipline

The monitor tracks TDD states:

```text
idle, red-pending, red, green, refactor
```

It warns when source is written before a failing test or while still waiting for the red phase to be established.

### Debugging discipline

The monitor warns when source fixes happen during active debugging before investigation. It escalates repeated failed fix attempts.

### Verification before completion

After a source edit, these actions require fresh verification:

- `git commit`
- `git push`
- `gh pr create`

### Branch safety

In a git repository:

- the first tool result should show the current branch or detached HEAD short SHA
- the first write/edit should warn that the agent must confirm the branch/worktree is correct

Failure to determine git state must not block work.

## TUI contract

The monitor exposes a compact widget with workflow phase and active guardrail state.

Example:

```text
✓brainstorm → [plan] → execute → verify → review → finish | TDD: RED | Debug: investigating
```

Required rendering semantics:

- current phase: `[phase]`
- complete phase: `✓phase`
- skipped phase: `–phase`
- pending phase: plain/dim phase name
- TDD status appears only when not idle
- debug status appears only when active
- task lists do not appear in this widget

## Command contract

### `/workflow-reset`

Resets workflow, TDD, debug, and verification state.

### `/workflow-next <phase> [artifact]`

Starts or prepares a fresh handoff session for the specified phase. The handoff must reference the artifact when provided and must use current package skill names and tool choices.

Required phase guidance:

| Phase | Guidance |
|---|---|
| `brainstorm` | `/skill:brainstorming` |
| `plan` | `/skill:writing-plans` |
| `execute` | `/skill:subagent-driven-development` or `/skill:executing-plans` |
| `verify` | `/skill:verification-before-completion` |
| `review` | `/skill:requesting-code-review` |
| `finish` | `/skill:finishing-a-development-branch` |

The handoff must not mention `plan_tracker`, plus agents, or `workflow_reference`.

## State persistence contract

The monitor persists state in Pi session custom entries and reconstructs from the latest matching entry on session start, tree navigation, and compaction.

The initial integration does not require project-file persistence such as `.pi/superpowers-state.json`.

## Acceptance criteria

1. The skill files satisfy the skill contract in this spec.
2. Runtime code recognises current artifact paths, `todo` signals, and `pi-subagents` signals.
3. Runtime code does not register or reference `workflow_reference`.
4. Runtime code does not include plus plan tracker or plus subagent extension logic.
5. Runtime code does not treat plus-local agent names as canonical names.
6. The TUI widget shows workflow phase plus active TDD/debug status.
7. `/workflow-next` uses current package skill/tool guidance.
8. Guardrails cover thinking-phase writes, TDD order, debugging discipline, stale verification, and branch safety.
9. `npm test` passes.
