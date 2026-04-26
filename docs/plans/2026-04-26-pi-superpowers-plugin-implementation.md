# Pi Superpowers Plugin Implementation Plan

> **Bootstrap constraint:** This plan implements the Superpowers plugin itself. Do **not** require the plugin being built to already work. Execute this plan with the current Pi/harness tools and ordinary disciplined development practices. The package being built may only be used after its bootstrap, skills, and tests exist and pass.

**Goal:** Turn this repository into an installable Pi package that injects canonical `obra/superpowers` behavior, exposes canonical Superpowers skills adapted for Pi, reinforces workflow guardrails at runtime, and uses existing Pi packages for task tracking and subagent execution.

**Architecture:** `pi-superpowers` owns canonical Superpowers behavior injection, canonical Pi-adapted skills, and workflow-monitor guardrails. Task tracking is provided by `@juicesharp/rpiv-todo` via its `todo` tool. Subagent execution is provided by `pi-subagents` via its `subagent` tool.

**Tech Stack:** Pi package manifest, TypeScript Pi extensions, Node 24 built-in test runner with `--experimental-strip-types`, Pi extension APIs from `@mariozechner/pi-coding-agent`, and TUI APIs from `@mariozechner/pi-tui`.

---

## External Companion Packages

This package expects exactly two existing Pi packages to be installed at runtime, but does not bundle them:

```bash
pi install npm:@juicesharp/rpiv-todo
pi install npm:pi-subagents
```

### `@juicesharp/rpiv-todo`

Use this as the Pi replacement for canonical Superpowers `TodoWrite` guidance.

Provided surface:

```ts
todo({ action: "create", subject: "Research existing behavior" })
todo({ action: "update", id: 1, status: "in_progress", activeForm: "researching behavior" })
todo({ action: "update", id: 1, status: "completed" })
todo({ action: "list" })
todo({ action: "get", id: 1 })
todo({ action: "delete", id: 1 })
todo({ action: "clear" })
```

Status machine:

```text
pending → in_progress → completed
pending/in_progress/completed → deleted
```

It also supports `blockedBy`, `addBlockedBy`, `removeBlockedBy`, `owner`, and `metadata`.

### `pi-subagents`

Use this for all subagent execution. This package must not implement its own `subagent` tool.

Implementation agents may use `pi-subagents` builtins such as `worker` when the prompt carries the canonical Superpowers implementer contract.

Review agents must be read-only. Do **not** use `pi-subagents` builtin `reviewer` for canonical code/spec review, because that builtin is a review-and-fix agent with edit/write tools. Canonical Superpowers review requires reviewers to inspect and report, not modify files.

Canonical reviewer role names for this package:

- `superpowers-spec-reviewer` — read-only spec compliance reviewer.
- `superpowers-code-reviewer` — read-only production-readiness reviewer.

This repo bundles those reviewer definitions as package-owned templates under `agents/`. Users can copy them into their own repository to customize reviewer behavior. The adapted skills should refer to these reviewer role names and bundled templates without prescribing where a user's `pi-subagents` installation stores copied/customized agents.

Examples:

```ts
subagent({ agent: "worker", task: "...", context: "fresh" })
```

```ts
subagent({ agent: "superpowers-code-reviewer", task: "...", context: "fresh" })
```

```ts
subagent({
  tasks: [
    { agent: "worker", task: "Fix test file A" },
    { agent: "worker", task: "Fix test file B" }
  ],
  worktree: true
})
```

---

## Files to Create or Modify

### Create

- `package.json` — Pi package manifest and scripts.
- `LICENSE` — MIT license file matching package metadata.
- `README.md` — install, companion package, and architecture docs.
- `agents/superpowers-spec-reviewer.md` — bundled read-only spec reviewer template users may copy into their repo to customize.
- `agents/superpowers-code-reviewer.md` — bundled read-only code reviewer template users may copy into their repo to customize.
- `extensions/bootstrap.ts` — mandatory Superpowers bootstrap injection.
- `extensions/workflow-monitor.ts` — Pi workflow monitor entry point.
- `extensions/workflow-monitor/heuristics.ts` — source/test/path classification.
- `extensions/workflow-monitor/test-runner.ts` — test command/result detection.
- `extensions/workflow-monitor/workflow-tracker.ts` — phase tracking and skill parsing.
- `extensions/workflow-monitor/git.ts` — current branch/SHA helper.
- `extensions/workflow-monitor/warnings.ts` — warning text.
- `extensions/workflow-monitor/workflow-handler.ts` — pure monitor state machine.
- `extensions/workflow-monitor/workflow-transitions.ts` — phase boundary prompts.
- `extensions/workflow-monitor/skip-confirmation.ts` — unresolved phase helper.
- `tests/package-metadata.test.ts` — package manifest checks.
- `tests/bootstrap.test.ts` — bootstrap prompt tests.
- `tests/workflow-monitor.test.ts` — workflow monitor helper tests.
- `tests/skills.test.ts` — skill adaptation regression tests.
- `tests/readme.test.ts` — documentation regression tests.

### Modify

- `skills/using-superpowers/SKILL.md` — canonical `obra` text adapted to Pi.
- `skills/subagent-driven-development/SKILL.md` — canonical process, Pi `subagent`, Pi `todo`.
- `skills/subagent-driven-development/implementer-prompt.md` — canonical status protocol preserved.
- `skills/subagent-driven-development/spec-reviewer-prompt.md` — canonical spec-review behavior preserved.
- `skills/subagent-driven-development/code-quality-reviewer-prompt.md` — Pi subagent dispatch wording.
- `skills/dispatching-parallel-agents/SKILL.md` — Pi `subagent({ tasks })` examples.
- `skills/requesting-code-review/SKILL.md` — Pi `subagent` examples.
- `skills/requesting-code-review/code-reviewer.md` — read-only reviewer boundary and rubric.
- Any other `skills/**` files that contain stale harness-only instructions.

## Task 1: Define Package Manifest

**TDD scenario:** New package file — write failing tests first.

**Files:**
- Create: `tests/package-metadata.test.ts`
- Create: `package.json`
- Create: `LICENSE`

### Steps

- [ ] **Step 1: Write the failing metadata test**

Create `tests/package-metadata.test.ts`:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package is an installable Pi package", () => {
  assert.equal(pkg.name, "pi-superpowers");
  assert.equal(pkg.type, "module");
  assert.ok(pkg.keywords.includes("pi-package"));
});

test("package exposes only owned extensions and skills", () => {
  assert.deepEqual(pkg.pi.skills, ["skills"]);
  assert.deepEqual(pkg.pi.extensions, [
    "extensions/bootstrap.ts",
    "extensions/workflow-monitor.ts",
  ]);
});

test("package has matching MIT license metadata and file", () => {
  assert.equal(pkg.license, "MIT");
  assert.equal(existsSync(new URL("../LICENSE", import.meta.url)), true);
});

test("test script runs root test files without fragile recursive shell globs", () => {
  assert.equal(pkg.scripts.test, "node --experimental-strip-types --test tests/*.test.ts");
});

test("imported Pi core packages are peer dependencies", () => {
  assert.deepEqual(pkg.peerDependencies, {
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*"
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because `package.json` is missing**

```bash
node --experimental-strip-types --test tests/package-metadata.test.ts
```

Expected: FAIL with missing `package.json`.

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "pi-superpowers",
  "version": "0.1.0",
  "description": "Canonical Superpowers workflow skills and runtime guardrails for pi",
  "type": "module",
  "license": "MIT",
  "author": "casualjim",
  "keywords": ["pi-package", "pi", "superpowers", "agent-skills", "workflow"],
  "repository": {
    "type": "git",
    "url": "https://github.com/casualjim/pi-superpowers.git"
  },
  "files": [
    "extensions/",
    "skills/",
    "README.md",
    "LICENSE",
    "agents/"
  ],
  "scripts": {
    "test": "node --experimental-strip-types --test tests/*.test.ts"
  },
  "pi": {
    "extensions": [
      "extensions/bootstrap.ts",
      "extensions/workflow-monitor.ts"
    ],
    "skills": ["skills"]
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@mariozechner/pi-tui": "*"
  }
}
```

- [ ] **Step 4: Create `LICENSE`**

Create `LICENSE` with the standard MIT license text and copyright holder `casualjim`.

- [ ] **Step 5: Run metadata test and verify it passes**

```bash
node --experimental-strip-types --test tests/package-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json LICENSE tests/package-metadata.test.ts
git commit -m "chore: define pi superpowers package"
```

---

## Task 2: Add Mandatory Bootstrap Injection

**TDD scenario:** New extension — test pure prompt helpers first, then wire Pi hook.

**Files:**
- Create: `tests/bootstrap.test.ts`
- Create: `extensions/bootstrap.ts`

### Steps

- [ ] **Step 1: Write failing bootstrap tests**

Create `tests/bootstrap.test.ts`:

```ts
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
```

- [ ] **Step 2: Run bootstrap tests and verify they fail**

```bash
node --experimental-strip-types --test tests/bootstrap.test.ts
```

Expected: FAIL because `extensions/bootstrap.ts` does not exist.

- [ ] **Step 3: Create `extensions/bootstrap.ts`**

Implementation requirements:

- Export:
  - `BOOTSTRAP_MARKER`
  - `stripFrontmatter(content: string): string`
  - `buildBootstrapPrompt(usingSuperpowersContent: string): string`
  - `buildCompanionNotice(activeToolNames: readonly string[]): string`
  - `shouldInjectBootstrap(systemPrompt?: string): boolean`
- Read `skills/using-superpowers/SKILL.md` at extension startup.
- Use `before_agent_start` to append bootstrap to `event.systemPrompt`.
- Use `pi.getActiveTools()` to detect whether `todo` and `subagent` are actually available to the model in the current session; append a compact companion-package warning when either tool is missing.
- Do not inject into subagent child processes when `PI_SUBAGENT_DEPTH > 0`.
- Include Pi tool mapping:
  - `TodoWrite` → `todo` from `@juicesharp/rpiv-todo`
  - Claude Code `Task` / Superpowers subagent references → `subagent` from `pi-subagents`
  - `Read`/`Write`/`Edit`/`Bash` → Pi `read`/`write`/`edit`/`bash`
- State that `@juicesharp/rpiv-todo` and `pi-subagents` are installed companion packages.

- [ ] **Step 4: Run bootstrap tests and verify they pass**

```bash
node --experimental-strip-types --test tests/bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all current tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add extensions/bootstrap.ts tests/bootstrap.test.ts
git commit -m "feat: inject superpowers bootstrap in pi"
```

---

## Task 3: Add Workflow Monitor Helpers

**TDD scenario:** New pure helper modules — write helper tests first.

**Files:**
- Create: `tests/workflow-monitor.test.ts`
- Create: `extensions/workflow-monitor/heuristics.ts`
- Create: `extensions/workflow-monitor/test-runner.ts`
- Create: `extensions/workflow-monitor/workflow-tracker.ts`
- Create: `extensions/workflow-monitor/skip-confirmation.ts`

### Steps

- [ ] **Step 1: Write failing workflow helper tests**

Create `tests/workflow-monitor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run helper tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

Expected: FAIL because helper modules do not exist.

- [ ] **Step 3: Create `heuristics.ts`**

Requirements:

- `isAllowedThinkingPhaseWrite(filePath, cwd)` returns true only for:
  - `docs/specs/`
  - `docs/plans/`
- `isSourceFile(filePath)` returns true for implementation source extensions but false for test files and markdown.
- `isTestFile(filePath)` recognizes `.test.`, `.spec.`, `tests/`, `test/`, and `__tests__/`.

- [ ] **Step 4: Create `test-runner.ts`**

Requirements:

- `parseTestCommand(command)` recognizes:
  - `node --test`
  - `npm test`
  - `npm run test`
  - `pnpm test`
  - `yarn test`
  - `vitest`
  - `jest`
  - `pytest`
  - `cargo test`
  - `go test`
- `parseTestResult(output, exitCode)` returns:
  - `true` for exit code `0`
  - `false` for non-zero exit code
  - `null` when unknown and no exit code exists

- [ ] **Step 5: Create `workflow-tracker.ts`**

Requirements:

```ts
export const WORKFLOW_PHASES = ["brainstorm", "plan", "execute", "verify", "review", "finish"] as const;
```

Map canonical skills:

```ts
brainstorming -> brainstorm
writing-plans -> plan
executing-plans -> execute
subagent-driven-development -> execute
verification-before-completion -> verify
requesting-code-review -> review
finishing-a-development-branch -> finish
```

`parseSkillName` must recognize:

- `/skill:name`
- `skill:name`
- `superpowers:name`

- [ ] **Step 6: Create `skip-confirmation.ts`**

Port the unresolved-phase helper idea from coctostan, but import local phase types. Keep it pure.

- [ ] **Step 7: Run workflow helper tests and verify they pass**

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add extensions/workflow-monitor tests/workflow-monitor.test.ts
git commit -m "feat: add workflow monitor helpers"
```

---

## Task 4: Add Workflow Monitor Extension Wiring

**TDD scenario:** Extend tested helper modules — add workflow-handler tests first, then wire event hooks.

**Files:**
- Create: `extensions/workflow-monitor.ts`
- Create: `extensions/workflow-monitor/git.ts`
- Create: `extensions/workflow-monitor/warnings.ts`
- Create: `extensions/workflow-monitor/workflow-handler.ts`
- Create: `extensions/workflow-monitor/workflow-transitions.ts`
- Modify: `tests/workflow-monitor.test.ts`

### Steps

- [ ] **Step 1: Add failing workflow-handler tests**

Add this import with the existing imports at the top of `tests/workflow-monitor.test.ts`:

```ts
import { createWorkflowHandler } from "../extensions/workflow-monitor/workflow-handler.ts";
```

Then append these tests:

```ts
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
```

- [ ] **Step 2: Run workflow tests and verify they fail**

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

Expected: FAIL because `workflow-handler.ts` does not exist.

- [ ] **Step 3: Create `workflow-handler.ts`**

Requirements:

- Own only Superpowers process-monitor state, not task state.
- Detect skill invocations and phase transitions.
- Flag writes outside canonical docs paths during `brainstorm` and `plan`.
- Record source edits using `isSourceFile`.
- Record passing test command after source edits as fresh verification.
- Warn on `git commit`, `git push`, and `gh pr create` when verification is stale.
- Track debug mode after repeated failing test runs.
- Expose serializable state helpers: `getFullState()`, `setFullState(state)`, and `resetState()`.
- Do not implement `handleTodoToolCall` or any other todo-specific workflow state. Todo tracking belongs to `@juicesharp/rpiv-todo`.

- [ ] **Step 4: Create `git.ts`**

Requirements:

- Export `getCurrentGitRef(cwd = process.cwd()): string | null`.
- Use `git branch --show-current`; fall back to short `git rev-parse --short HEAD` for detached HEAD.
- Return `null` outside git repos or on command failure.

- [ ] **Step 5: Create `warnings.ts`**

Requirements:

- Warning text must reinforce canonical Superpowers, not replace it.
- Process warning must say Brainstorm/Plan writes are limited to:
  - `docs/specs/`
  - `docs/plans/`
- TDD warning must preserve strict canonical rule:
  - `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`
- Verification warning must explain what command triggered it and what verification is missing.

- [ ] **Step 6: Create `workflow-transitions.ts`**

Requirements:

- Define boundary prompts for:
  - design written → plan
  - plan written → execute
  - execution complete → verify
  - verification passed → review
  - review complete → finish
- Prompt options:
  - continue in current session by pre-filling the next `/skill:name`
  - start fresh session by pre-filling `/workflow-next <phase> [artifact]`; only the `/workflow-next` command performs session creation
  - skip
  - discuss/cancel

- [ ] **Step 7: Create `extensions/workflow-monitor.ts`**

Requirements:

- Register event listeners for:
  - `session_start` for startup/reload/new/resume/fork state reconstruction
  - `session_tree` and `session_compact` for branch/compaction state reconstruction
  - `session_shutdown` for cleanup
  - `input` for skill/phase detection
  - `tool_call` for write/edit/bash preflight
  - `tool_result` for warning injection and test result recording
  - `agent_end` for phase boundary prompts
- Persist workflow monitor state with `pi.appendEntry("pi-superpowers-workflow-state", handler.getFullState())` after state changes.
- Reconstruct state by scanning `ctx.sessionManager.getBranch()` for the latest custom entry with custom type `pi-superpowers-workflow-state`.
- Do not persist workflow state to project files by default; workflow state is session/branch state, not repository content.
- Register commands:
  - `/workflow-reset`: reset handler state, append the reset state entry, and refresh the widget.
  - `/workflow-next <phase> [artifact]`: validate phase, create a new session with the current session as parent, and prefill the editor with the next-step instructions plus optional artifact context. Do not automatically submit the prefilled text.
- Add TUI widget showing workflow phase, TDD/debug state when active.
- Derive workflow phase from Superpowers signals: skill invocation, canonical spec/plan artifact writes, source edits, test results, and completion commands.
- Treat `@juicesharp/rpiv-todo` as the task-list provider with its own state and overlay.

- [ ] **Step 8: Run workflow tests**

```bash
node --experimental-strip-types --test tests/workflow-monitor.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add extensions/workflow-monitor.ts extensions/workflow-monitor tests/workflow-monitor.test.ts
git commit -m "feat: add superpowers workflow monitor"
```

---

## Task 5: Normalize Canonical Skills for Pi

**TDD scenario:** Existing content normalization — write text regression tests first.

**Files:**
- Create: `tests/skills.test.ts`
- Create: `agents/superpowers-spec-reviewer.md`
- Create: `agents/superpowers-code-reviewer.md`
- Modify: `skills/using-superpowers/SKILL.md`
- Modify: `skills/subagent-driven-development/SKILL.md`
- Modify: `skills/subagent-driven-development/implementer-prompt.md`
- Modify: `skills/dispatching-parallel-agents/SKILL.md`
- Modify: `skills/requesting-code-review/SKILL.md`
- Modify: other `skills/**` files only when tests or comparison reveal stale platform-specific instructions.

### Steps

- [ ] **Step 1: Write failing skill normalization tests**

Create `tests/skills.test.ts`:

```ts
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
```

- [ ] **Step 2: Run skill tests and verify they fail on current content**

```bash
node --experimental-strip-types --test tests/skills.test.ts
```

Expected: FAIL if skills still contain `Task(`, `Task tool`, `TodoWrite`, `plan_tracker`, coctostan TDD scenario language, or missing canonical subagent statuses.

- [ ] **Step 3: Adapt `using-superpowers` from canonical**

Source:

```text
/Users/ivan/github/obra/superpowers/skills/using-superpowers/SKILL.md
```

Required Pi adaptations:

- Keep canonical hard requirement to invoke relevant skills before action.
- Keep user instruction priority.
- Replace harness access section with Pi access:
  - Pi lists skill descriptions in the system prompt.
  - Use `/skill:name` to force-load a skill.
  - When a task matches a skill, read/load the skill before responding or acting.
- Replace `TodoWrite` checklist/task tracking instruction with `todo`:

```ts
todo({ action: "create", subject: "Explore project context" })
todo({ action: "update", id: 1, status: "in_progress", activeForm: "exploring project context" })
todo({ action: "update", id: 1, status: "completed" })
```

- Keep `<SUBAGENT-STOP>`.

- [ ] **Step 4: Adapt `subagent-driven-development` from canonical**

Sources:

```text
/Users/ivan/github/obra/superpowers/skills/subagent-driven-development/SKILL.md
/Users/ivan/github/obra/superpowers/skills/subagent-driven-development/implementer-prompt.md
/Users/ivan/github/obra/superpowers/skills/subagent-driven-development/spec-reviewer-prompt.md
/Users/ivan/github/obra/superpowers/skills/subagent-driven-development/code-quality-reviewer-prompt.md
```

Required Pi adaptations:

- Replace Claude `Task` tool wording with `subagent` calls.
- Replace `TodoWrite` with `todo`.
- Keep canonical rules:
  - fresh subagent per task
  - precise context, not inherited session history
  - implementer self-review
  - statuses `DONE`, `DONE_WITH_CONCERNS`, `BLOCKED`, `NEEDS_CONTEXT`
  - spec compliance review before code quality review
  - never move to next task with open review issues
- Use examples:

```ts
subagent({ agent: "worker", task: "...filled implementer prompt...", context: "fresh" })
```

```ts
subagent({ agent: "superpowers-spec-reviewer", task: "...filled spec review prompt...", context: "fresh" })
```

```ts
subagent({ agent: "superpowers-code-reviewer", task: "...filled code review prompt...", context: "fresh" })
```

- Create bundled reviewer templates:
  - `agents/superpowers-spec-reviewer.md` contains the read-only spec compliance reviewer contract from `skills/subagent-driven-development/spec-reviewer-prompt.md`.
  - `agents/superpowers-code-reviewer.md` contains the read-only production readiness reviewer contract from `skills/subagent-driven-development/code-quality-reviewer-prompt.md` / `skills/requesting-code-review/code-reviewer.md`.
- Include a prerequisite section that explains the read-only reviewer agents are bundled in `agents/` as package-owned templates.
- State that users can copy `agents/superpowers-spec-reviewer.md` and `agents/superpowers-code-reviewer.md` into their repository to customize reviewer behavior.
- Do not include `agentScope` or `scope: "user"` in the skill text.
- Do not include automatic `subagent({ action: "create" })` snippets in the skill text.

- [ ] **Step 5: Adapt `dispatching-parallel-agents` from canonical**

Source:

```text
/Users/ivan/github/obra/superpowers/skills/dispatching-parallel-agents/SKILL.md
```

Required Pi adaptations:

- Replace `Task(...)` with:

```ts
subagent({
  tasks: [
    { agent: "worker", task: "Fix agent-tool-abort.test.ts failures" },
    { agent: "worker", task: "Fix batch-completion-behavior.test.ts failures" },
    { agent: "worker", task: "Fix tool-approval-race-conditions.test.ts failures" }
  ]
})
```

- For write-capable parallel work, recommend `worktree: true`.

- [ ] **Step 6: Adapt `requesting-code-review` from canonical**

Sources:

```text
/Users/ivan/github/obra/superpowers/skills/requesting-code-review/SKILL.md
/Users/ivan/github/obra/superpowers/skills/requesting-code-review/code-reviewer.md
```

Required Pi adaptations:

- Replace code-reviewer `Task` wording with:

```ts
subagent({
  agent: "superpowers-code-reviewer",
  task: "...filled code-reviewer.md template...",
  context: "fresh"
})
```

- Keep read-only reviewer boundary and severity rubric.
- Explicitly forbid dispatching canonical code review to builtin `reviewer`, because that agent may edit files.

- [ ] **Step 7: Normalize remaining skills as needed**

For each remaining skill:

1. Compare with `/Users/ivan/github/obra/superpowers/skills/<name>/`.
2. Preserve canonical behavior.
3. Apply only Pi platform substitutions:
   - `TodoWrite` → `todo`
   - `Task` subagent examples → `subagent`
   - harness skill syntax → Pi `/skill:name`
4. Preserve canonical artifact paths:
   - `docs/specs/`
   - `docs/plans/`

- [ ] **Step 8: Run skill tests**

```bash
node --experimental-strip-types --test tests/skills.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add skills tests/skills.test.ts
git commit -m "feat: adapt canonical superpowers skills for pi"
```

---

## Task 6: Document Installation, Companion Packages, and Behavior

**TDD scenario:** Documentation — write README tests first.

**Files:**
- Create: `tests/readme.test.ts`
- Create: `README.md`

### Steps

- [ ] **Step 1: Write failing README tests**

Create `tests/readme.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("README documents installation", () => {
  assert.match(readme, /pi install/i);
  assert.match(readme, /pi-superpowers/i);
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

test("README documents read-only reviewer agents", () => {
  assert.match(readme, /superpowers-spec-reviewer/);
  assert.match(readme, /superpowers-code-reviewer/);
  assert.match(readme, /agents\//);
  assert.match(readme, /copy.*repository.*customize/is);
  assert.match(readme, /not the builtin.*reviewer/is);
});

```

- [ ] **Step 2: Run README tests and verify they fail**

```bash
node --experimental-strip-types --test tests/readme.test.ts
```

Expected: FAIL because `README.md` does not exist.

- [ ] **Step 3: Create `README.md`**

Required sections:

```md
# pi-superpowers

Canonical Superpowers workflow skills and runtime guardrails for Pi.

## Canonical Source

This package treats obra/superpowers as canonical for methodology and skill behavior.

## Required Companion Packages

pi install npm:@juicesharp/rpiv-todo
pi install npm:pi-subagents

## Installation

pi install git:github.com/casualjim/pi-superpowers

## What This Package Provides

- mandatory Superpowers bootstrap injection
- canonical Superpowers skills adapted for Pi
- workflow monitor guardrails

## Tool Mapping

- TodoWrite → todo from @juicesharp/rpiv-todo
- Task/subagent workflow → subagent from pi-subagents

## Reviewer Agents

Canonical Superpowers review is read-only. This repo bundles `agents/superpowers-spec-reviewer.md` and `agents/superpowers-code-reviewer.md` as reviewer templates. Users can copy those templates into their repository to customize reviewer behavior. Use those reviewer contracts, not the builtin review-and-fix `reviewer` agent.
```

- [ ] **Step 4: Run README tests**

```bash
node --experimental-strip-types --test tests/readme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md tests/readme.test.ts
git commit -m "docs: document pi superpowers package"
```

---

## Task 7: Final Verification

**TDD scenario:** Verification task — no planned code changes unless checks fail.

**Files:**
- No planned changes.

### Steps

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Verify package manifest resources**

```bash
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.pi,null,2))"
```

Expected:

```json
{
  "extensions": [
    "extensions/bootstrap.ts",
    "extensions/workflow-monitor.ts"
  ],
  "skills": [
    "skills"
  ]
}
```

- [ ] **Step 3: Verify stale skill tool references are absent**

```bash
grep -R "TodoWrite\|plan_tracker\|Task(\|Task tool" skills || true
```

Expected: no output. Skill files should contain the Pi-adapted tool names directly.

- [ ] **Step 4: Verify bootstrap and README contain only deliberate tool mappings**

```bash
grep -R "TodoWrite\|@juicesharp/rpiv-todo\|pi-subagents" extensions/bootstrap.ts README.md
```

Expected: output only from deliberate mapping/dependency documentation.

- [ ] **Step 5: Verify canonical artifact paths**

```bash
grep -R "docs/specs\|docs/plans" skills extensions README.md
```

Expected: product behavior references canonical `docs/specs/` and `docs/plans/`.

- [ ] **Step 6: Review diff**

```bash
git diff --stat
git diff
```

Expected: changes are limited to package metadata, README, extensions, tests, and skill adaptations.

- [ ] **Step 7: Fix and commit any verification failures**

If fixes are required:

```bash
git add <fixed-files>
git commit -m "fix: resolve pi superpowers verification issues"
```

If no fixes are required, do not create an empty commit.

---
