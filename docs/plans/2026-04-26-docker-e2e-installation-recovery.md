# Docker E2E Installation Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Docker-backed integration test that proves a real Pi install can fail its way to a working `pi-superpowers` installation.

**Architecture:** Add a single mise integration task. The task builds and runs a Docker image so Docker invocations inherit the mise/fnox caller environment. The image copies this repository, installs the real Pi CLI, creates an isolated temp project, installs package resources project-locally, drives real Pi with `zai/glm-5-turbo`, and verifies missing dependency recovery commands plus project-local reviewer agents. The default `npm test` path remains unit-only.

**Tech Stack:** Node 24 built-in test runner, Docker, real `pi` CLI, `npm:@thesethrose/pi-zai-provider`, `@juicesharp/rpiv-todo`, `pi-subagents`, Zai model `zai/glm-5-turbo`.

---

## Secret handling rule

Do not inspect, decrypt, validate, or preflight `ZAI_API_KEY`. Do not run secret inspection commands. The test assumes the caller provides `ZAI_API_KEY` in the environment. If the secret is absent or invalid, the underlying Pi/Zai command fails naturally.

---

## Files

- Modify: `package.json`
- Modify: `tests/package-metadata.test.ts`
- Create: `.dockerignore`
- Create: `tests/integration/docker/Dockerfile`
- Create: `tests/integration/docker/run-e2e.ts`
- Modify: `README.md`
- Modify: `tests/readme.test.ts`

---

## Task 1: Add Integration Script Metadata

**Files:**
- Modify: `package.json`
- Modify: `tests/package-metadata.test.ts`

- [ ] **Step 1: Write failing mise task assertion**

Modify `tests/package-metadata.test.ts` by adding this test after the existing script test:

```ts
test("integration task runs Docker-backed real Pi tests through mise", () => {
  assert.equal(pkg.scripts["test:integration"], undefined);
  assert.match(mise, /\[tasks\."test:integration"\]/);
  assert.match(mise, /node --experimental-strip-types --test tests\/integration\/\*\.test\.ts/);
  assert.doesNotMatch(mise, /\[tasks\."test:integration:local"\]/);
});
```

- [ ] **Step 2: Run metadata tests and verify failure**

```bash
node --experimental-strip-types --test tests/package-metadata.test.ts
```

Expected: FAIL because the mise integration tasks are undefined.

- [ ] **Step 3: Add integration mise tasks**

Modify `mise.toml` to add:

```toml
[tasks."test:integration"]
description = "Run Docker-backed real Pi integration tests"
run = """
set -euo pipefail
docker build --progress=plain -f tests/integration/docker/Dockerfile -t pi-superpowers-e2e .
docker run --rm -e ZAI_API_KEY pi-superpowers-e2e
"""

```

- [ ] **Step 4: Verify metadata tests pass**

```bash
node --experimental-strip-types --test tests/package-metadata.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/package-metadata.test.ts
git commit -m "test: add integration test scripts"
```

---

## Task 2: Add Docker Build Files

**Files:**
- Create: `.dockerignore`
- Create: `tests/integration/docker/Dockerfile`
- Create: `tests/integration/docker/run-e2e.ts`

- [ ] **Step 1: Write failing integration infrastructure tests**

The mise task directly builds and runs the Docker image:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dockerfile = readFileSync(new URL("./docker/Dockerfile", import.meta.url), "utf8");
const runner = readFileSync(new URL("./docker/run-e2e.ts", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../../.dockerignore", import.meta.url), "utf8");

test("Docker integration assets exist", () => {
  assert.equal(existsSync(new URL("./docker/Dockerfile", import.meta.url)), true);
  assert.equal(existsSync(new URL("./docker/run-e2e.ts", import.meta.url)), true);
});

test("Dockerfile copies repo instead of bind mounting it", () => {
  assert.match(dockerfile, /FROM node:24-bookworm/);
  assert.match(dockerfile, /COPY \. \/workspace\/pi-superpowers/);
  assert.match(dockerfile, /npm install -g @mariozechner\/pi-coding-agent/);
  assert.match(dockerfile, /CMD \["node", "--experimental-strip-types", "tests\/integration\/docker\/run-e2e\.ts"\]/);
});

test("Docker build ignores host generated artifacts", () => {
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.git$/m);
  assert.match(dockerignore, /^\.pi\/npm$/m);
  assert.match(dockerignore, /^\.pi\/git$/m);
});

test("runner passes through ZAI_API_KEY and uses real Pi recovery dependencies", () => {
  assert.match(runner, /ZAI_API_KEY/);
  assert.doesNotMatch(runner, /ZAI_API_KEY is required/);
  assert.doesNotMatch(runner, /fnox (get|export|check)/);
  assert.match(runner, /zai\/glm-5-turbo/);
  assert.match(runner, /npm:@thesethrose\/pi-zai-provider/);
  assert.match(runner, /npm:@juicesharp\/rpiv-todo/);
  assert.match(runner, /npm:pi-subagents/);
  assert.match(runner, /superpowers-spec-reviewer/);
  assert.match(runner, /project verification command/);
});
```

- [ ] **Step 2: Run integration tests and verify failure**

```bash
mise run test:integration
```

Expected: FAIL because Docker assets do not exist.

- [ ] **Step 3: Create `.dockerignore`**

Create `.dockerignore`:

```gitignore
node_modules
.git
.pi/npm
.pi/git
npm-debug.log
.DS_Store
```

- [ ] **Step 4: Create Dockerfile**

Create `tests/integration/docker/Dockerfile`:

```Dockerfile
FROM node:24-bookworm

ENV HOME=/tmp/pi-home
ENV PI_CODING_AGENT_DIR=/tmp/pi-home/.pi/agent
ENV PI_OFFLINE=0

WORKDIR /workspace/pi-superpowers
COPY . /workspace/pi-superpowers

RUN npm install -g @mariozechner/pi-coding-agent

CMD ["node", "--experimental-strip-types", "tests/integration/docker/run-e2e.ts"]
```

- [ ] **Step 5: Create runner skeleton**

Create `tests/integration/docker/run-e2e.ts` with:

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, cpSync } from "node:fs";

const PROJECT = "/tmp/e2e-project";
const SESSION_DIR = "/tmp/e2e-sessions";
const REPO = "/workspace/pi-superpowers";
const MODEL = "zai/glm-5-turbo";

function fail(message, details = "") {
  console.error(`\n[E2E FAIL] ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function run(name, command, args, options = {}) {
  console.error(`\n[E2E] ${name}`);
  console.error([command, ...args].join(" "));
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT,
    env: { ...process.env, HOME: "/tmp/pi-home", PI_CODING_AGENT_DIR: "/tmp/pi-home/.pi/agent" },
    encoding: "utf8",
    timeout: options.timeout ?? 180_000,
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${name} exited ${result.status}`, combined);
  }
  return { ...result, combined };
}

function assertIncludes(text, expected, phase) {
  if (!text.includes(expected)) fail(`${phase}: missing expected text`, `Expected: ${expected}\n\nOutput:\n${text}`);
}

function assertNotIncludes(text, unexpected, phase) {
  if (text.includes(unexpected)) fail(`${phase}: found unexpected text`, `Unexpected: ${unexpected}\n\nOutput:\n${text}`);
}

function piPrompt(name, prompt, options = {}) {
  return run(name, "pi", ["--model", MODEL, "--session-dir", SESSION_DIR, "-p", prompt], options).combined;
}

mkdirSync(`${PROJECT}/.pi/agents`, { recursive: true });
mkdirSync(`${PROJECT}/src`, { recursive: true });
mkdirSync(`${PROJECT}/tests`, { recursive: true });
mkdirSync(SESSION_DIR, { recursive: true });

writeFileSync(`${PROJECT}/package.json`, JSON.stringify({ type: "module", scripts: { test: "node --experimental-strip-types --test tests/*.test.ts" } }, null, 2));
writeFileSync(`${PROJECT}/mise.toml`, '[tasks.test]\nrun = "npm test"\n');
writeFileSync(`${PROJECT}/src/math.ts`, 'export function add(a: number, b: number): number { return a + b; }\n');
writeFileSync(`${PROJECT}/tests/math.test.ts`, 'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { add } from "../src/math.ts";\n\ntest("adds", () => assert.equal(add(2, 3), 5));\n');

run("install pi-superpowers", "pi", ["install", "-l", REPO]);
run("install zai provider", "pi", ["install", "-l", "npm:@thesethrose/pi-zai-provider"]);

const warningPrompt = "Report the pi-superpowers companion package warning from your system prompt verbatim. Include install commands exactly if present.";

const phase1 = piPrompt("phase 1 missing companions", warningPrompt);
assertIncludes(phase1, "pi install npm:@juicesharp/rpiv-todo", "phase 1");
assertIncludes(phase1, "pi install npm:pi-subagents", "phase 1");
assertIncludes(phase1, "todo", "phase 1");
assertIncludes(phase1, "subagent", "phase 1");

run("install todo companion", "pi", ["install", "-l", "npm:@juicesharp/rpiv-todo"]);
const phase2 = piPrompt("phase 2 missing subagents only", warningPrompt);
assertIncludes(phase2, "pi install npm:pi-subagents", "phase 2");
assertNotIncludes(phase2, "@juicesharp/rpiv-todo is missing", "phase 2");

run("install subagents companion", "pi", ["install", "-l", "npm:pi-subagents"]);
const phase3 = piPrompt("phase 3 companions installed", warningPrompt);
assertNotIncludes(phase3, "pi install npm:@juicesharp/rpiv-todo", "phase 3");
assertNotIncludes(phase3, "pi install npm:pi-subagents", "phase 3");

const missingReviewer = piPrompt("phase 4 missing reviewer", "Try to run subagent superpowers-spec-reviewer for a tiny spec review. If it is unavailable, explain how to copy bundled reviewer agents into .pi/agents using exact commands.", { allowFailure: true });
assertIncludes(missingReviewer, "mkdir -p .pi/agents", "phase 4 missing reviewer");
assertIncludes(missingReviewer, "cp /workspace/pi-superpowers/agents/superpowers-spec-reviewer.md .pi/agents/", "phase 4 missing reviewer");
assertIncludes(missingReviewer, "cp /workspace/pi-superpowers/agents/superpowers-code-reviewer.md .pi/agents/", "phase 4 missing reviewer");

cpSync(`${REPO}/agents/superpowers-spec-reviewer.md`, `${PROJECT}/.pi/agents/superpowers-spec-reviewer.md`);
cpSync(`${REPO}/agents/superpowers-code-reviewer.md`, `${PROJECT}/.pi/agents/superpowers-code-reviewer.md`);

const review = piPrompt("phase 4 reviewer works", "Use the subagent tool with agent superpowers-spec-reviewer to review src/math.ts against requirement: add(a,b) returns a+b. Return the reviewer result.", { timeout: 300_000 });
assertIncludes(review, "Spec", "phase 4 reviewer works");

const workflow = piPrompt("phase 5 workflow proof", "Create a todo for this E2E proof, run the project verification command, then report whether verification passed. Do not modify files.", { timeout: 300_000 });
assertIncludes(workflow.toLowerCase(), "verification", "phase 5 workflow proof");
assertIncludes(workflow.toLowerCase(), "pass", "phase 5 workflow proof");

console.log("Docker E2E installation recovery passed");
```

- [ ] **Step 6: Run infrastructure tests**

```bash
mise run test:integration
```

Expected: PASS without requiring Docker or secret availability, because these tests only inspect the assets.

- [ ] **Step 7: Commit**

```bash
git add .dockerignore tests/integration
git commit -m "test: add docker e2e harness"
```

---

## Task 3: Wire Docker Execution from Host Test

**Files:**

- [ ] **Step 1: Extend test to run Docker when executed**

Use the mise task as the Docker launcher:

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const dockerfile = readFileSync(new URL("./docker/Dockerfile", import.meta.url), "utf8");
const runner = readFileSync(new URL("./docker/run-e2e.ts", import.meta.url), "utf8");
const dockerignore = readFileSync(new URL("../../.dockerignore", import.meta.url), "utf8");
const imageTag = `pi-superpowers-e2e:${Date.now()}`;

function run(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: new URL("../..", import.meta.url),
    env: process.env,
    encoding: "utf8",
    timeout: 900_000,
  });
}

test("Docker integration assets are configured correctly", () => {
  assert.equal(existsSync(new URL("./docker/Dockerfile", import.meta.url)), true);
  assert.equal(existsSync(new URL("./docker/run-e2e.ts", import.meta.url)), true);
  assert.match(dockerfile, /FROM node:24-bookworm/);
  assert.match(dockerfile, /COPY \. \/workspace\/pi-superpowers/);
  assert.match(dockerfile, /npm install -g @mariozechner\/pi-coding-agent/);
  assert.match(dockerfile, /CMD \["node", "--experimental-strip-types", "tests\/integration\/docker\/run-e2e\.ts"\]/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.git$/m);
  assert.match(runner, /ZAI_API_KEY/);
  assert.doesNotMatch(runner, /ZAI_API_KEY is required/);
  assert.doesNotMatch(runner, /fnox (get|export|check)/);
  assert.match(runner, /zai\/glm-5-turbo/);
  assert.match(runner, /npm:@thesethrose\/pi-zai-provider/);
});

test("Docker E2E installation recovery works", { timeout: 1_200_000 }, () => {
  const dockerVersion = run("docker", ["--version"]);
  assert.equal(dockerVersion.status, 0, dockerVersion.stderr || dockerVersion.stdout);

  const build = run("docker", ["build", "-f", "tests/integration/docker/Dockerfile", "-t", imageTag, "."]);
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const args = ["run"];
  if (!process.env.PI_SUPERPOWERS_KEEP_E2E) args.push("--rm");
  args.push("-e", "ZAI_API_KEY", imageTag);
  const e2e = run("docker", args);
  assert.equal(e2e.status, 0, `${e2e.stdout}\n${e2e.stderr}`);
  assert.match(`${e2e.stdout}\n${e2e.stderr}`, /Docker E2E installation recovery passed/);
});
```

- [ ] **Step 2: Verify the test does not preflight secrets**

```bash
grep -R "ZAI_API_KEY is required" tests/integration package.json README.md || true
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add git commit -m "test: run docker e2e installation recovery"
```

---

## Task 4: Document Integration Test Usage

**Files:**
- Modify: `README.md`
- Modify: `tests/readme.test.ts`

- [ ] **Step 1: Add failing README assertions**

Append to `tests/readme.test.ts`:

```ts
test("README documents Docker integration test", () => {
  assert.match(readme, /mise run test:integration/);
  assert.doesNotMatch(readme, /test:integration:local/);
  assert.match(readme, /ZAI_API_KEY/);
  assert.match(readme, /zai\/glm-5-turbo/);
  assert.match(readme, /Docker/i);
  assert.match(readme, /@thesethrose\/pi-zai-provider/);
});
```

- [ ] **Step 2: Run README tests and verify failure**

```bash
node --experimental-strip-types --test tests/readme.test.ts
```

Expected: FAIL because README does not document integration testing.

- [ ] **Step 3: Update README**

Add section:

```md
## Docker E2E Installation Recovery Test

The default test suite is unit/regression only:

```bash
npm test
```

A dedicated real-Pi Docker integration test proves installation recovery end-to-end. The integration command is a mise task so your configured mise/fnox environment can provide `ZAI_API_KEY` without the test harness inspecting the secret:

```bash
mise run test:integration
```

This builds a Docker image that copies this repository into `/workspace/pi-superpowers`, installs the real Pi CLI, installs `npm:@thesethrose/pi-zai-provider`, uses `zai/glm-5-turbo`, and verifies the exact recovery commands for missing companion packages. The test assumes `ZAI_API_KEY` is provided by the caller and does not preflight or debug secrets.

`fnox.toml` and `mise.toml` are committed for local secret/tool environment setup, but `.dockerignore` excludes them from the Docker build context.
```

- [ ] **Step 4: Run README tests**

```bash
node --experimental-strip-types --test tests/readme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run default tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md tests/readme.test.ts
git commit -m "docs: document docker e2e test"
```

---

## Task 5: Run Integration Verification

**Files:**
- No planned changes unless verification fails.

- [ ] **Step 1: Verify default tests remain unit-only**

```bash
npm test
```

Expected: PASS. Output should not run Docker.

- [ ] **Step 2: Verify no secret preflight exists**

```bash
grep -R "ZAI_API_KEY is required" tests package.json README.md || true
```

Expected: no output.

- [ ] **Step 3: Run real Docker E2E with provided key**

```bash
mise run test:integration
```

Expected: PASS with `Docker E2E installation recovery passed`.

- [ ] **Step 4: Inspect host for accidental global artifacts**

```bash
find ~/.pi/agent/agents -maxdepth 1 \( -name 'superpowers-spec-reviewer.md' -o -name 'superpowers-code-reviewer.md' \) -print 2>/dev/null || true
git worktree list
```

Expected: no reviewer-agent output from host global agent dir; no extra worktrees.

- [ ] **Step 5: Commit fixes if needed**

If verification failures require changes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize docker e2e recovery test"
```

If no fixes are required, do not create an empty commit.
