# Docker E2E Installation Recovery Design

## Goal

Add an optional Docker-backed integration test that proves a real `pi` installation can fail its way to a working `pi-superpowers` setup. The test should run in an isolated container, use the real Pi CLI, install the Zai provider plugin, exercise missing companion-package diagnostics, install the missing pieces, copy bundled reviewer agents into a project-local agent directory, and verify a small workflow can run with `zai/glm-5-turbo`.

## Non-goals

- Do not add this to the default `npm test` path.
- Do not make the test CI-safe or keyless.
- Do not write host-global Pi settings, host-global agents, or host worktrees.
- Do not rely on host `~/.pi`, host `~/.agents`, or host npm globals.

## Runtime shape

The host runs the dedicated integration task:

```bash
mise run test:integration
```

The mise integration task builds a Docker image from this repository and runs it. The Dockerfile copies the repository into the image instead of bind-mounting the host checkout:

```bash
docker build -f tests/integration/docker/Dockerfile -t pi-superpowers-e2e .
docker run --rm -e ZAI_API_KEY pi-superpowers-e2e
```

The Docker build context must ignore host-generated artifacts, especially `node_modules/`, via a Docker ignore file. `fnox.toml` and `mise.toml` are committed for local setup but must not be copied into the Docker image.

Inside Docker:

- `HOME=/tmp/pi-home`
- `PI_CODING_AGENT_DIR=/tmp/pi-home/.pi/agent`
- test project lives at `/tmp/e2e-project`
- no host home directory is mounted

## Container setup

Use a Node 24 image. The Dockerfile must copy this package into `/workspace/pi-superpowers` and install the real Pi CLI in the container:

```Dockerfile
FROM node:24-bookworm

WORKDIR /workspace/pi-superpowers
COPY . /workspace/pi-superpowers

RUN npm install -g @mariozechner/pi-coding-agent

CMD ["node", "--experimental-strip-types", "tests/integration/docker/run-e2e.ts"]
```

Add a root `.dockerignore` for this build context with at least:

```gitignore
node_modules
.git
.pi/npm
.pi/git
fnox.toml
mise.toml
```

Create a temp project with:

```text
/tmp/e2e-project/
  .pi/settings.json
  .pi/agents/
  package.json
  mise.toml
  src/math.ts
  tests/math.test.ts
```

Install package resources project-locally inside `/tmp/e2e-project`:

```bash
pi install -l /workspace/pi-superpowers
pi install -l npm:@thesethrose/pi-zai-provider
```

The provider model for all real Pi prompts is:

```bash
pi --model zai/glm-5-turbo -p "..."
```

## Installation recovery flow

### Phase 1: Missing companion packages

Only `pi-superpowers` and `npm:@thesethrose/pi-zai-provider` are installed project-locally. Run a prompt that asks the model to report any Superpowers setup warning from its system prompt.

Expected output includes both exact recovery commands:

```bash
pi install npm:@juicesharp/rpiv-todo
pi install npm:pi-subagents
```

It must also mention the missing `todo` and `subagent` tools.

### Phase 2: Install todo companion only

Run:

```bash
pi install -l npm:@juicesharp/rpiv-todo
```

Run the setup-warning prompt again.

Expected output includes:

```bash
pi install npm:pi-subagents
```

Expected output does not report `@juicesharp/rpiv-todo` / `todo` as missing.

### Phase 3: Install subagents companion

Run:

```bash
pi install -l npm:pi-subagents
```

Run the setup-warning prompt again.

Expected output does not contain the companion-package warning and does not tell the user to install either companion package.

### Phase 4: Reviewer agent setup recovery

Before copying reviewer templates, attempt to use `superpowers-spec-reviewer` through `subagent`. The result should fail or report that the named agent is unavailable. The user-facing guidance in README/skills should include exact project-local copy commands:

```bash
mkdir -p .pi/agents
cp /workspace/pi-superpowers/agents/superpowers-spec-reviewer.md .pi/agents/
cp /workspace/pi-superpowers/agents/superpowers-code-reviewer.md .pi/agents/
```

Then the test executes those commands inside `/tmp/e2e-project`.

After copying, invoking `superpowers-spec-reviewer` should resolve the project-local agent and produce a read-only spec review for a tiny `add(a, b)` implementation.

### Phase 5: Workflow proof

Run a final prompt that proves the pieces work together:

1. Superpowers bootstrap is present.
2. `todo` is callable.
3. `subagent` is callable.
4. `superpowers-spec-reviewer` can be dispatched.
5. the project verification command runs and passes.
6. Workflow monitor recognizes the mise verification path and does not leave verification stale after the passing test.

## Test implementation

Add:

```text
tests/integration/docker/Dockerfile
tests/integration/docker/run-e2e.ts
```

Add mise tasks:

```toml
[tasks."test:integration"]
run = """
set -euo pipefail
docker build --progress=plain -f tests/integration/docker/Dockerfile -t pi-superpowers-e2e .
docker run --rm -e ZAI_API_KEY pi-superpowers-e2e
"""

```

The mise task requires Docker availability and assumes `ZAI_API_KEY` is provided by the caller's environment. Local execution relies on mise tasks for mise/fnox environment integration, but the test itself must not run fnox or inspect, decrypt, validate, or preflight secrets; missing or invalid secrets should fail naturally in the underlying Pi/Zai call.

## Failure diagnostics

The integration runner should print and preserve enough information to debug failures:

- phase name
- command run
- stdout/stderr snippets
- temp project path inside container
- Pi session directory path inside container

If `PI_SUPERPOWERS_KEEP_E2E=1` is set, the Docker command should not use `--rm` and should leave artifacts available for inspection.

## Acceptance criteria

- `npm test` remains unit-only and does not run Docker.
- `mise run test:integration` runs the Docker e2e as a mise task so the caller environment can provide `ZAI_API_KEY`.
- With `ZAI_API_KEY` provided, Docker runs real Pi using `zai/glm-5-turbo`.
- The missing-companion flow verifies exact recovery commands.
- The reviewer-agent flow verifies project-local `.pi/agents/` copies work.
- No global host Pi settings, host global agents, or host worktrees are created.
