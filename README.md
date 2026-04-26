# pi-superpowers

Canonical Superpowers workflow skills and runtime guardrails for Pi.

## Canonical Source

This package treats [`obra/superpowers`](https://github.com/obra/superpowers) as canonical for methodology and skill behavior. Pi-specific files adapt that behavior to Pi tools and package conventions.

## Required Companion Packages

Install the runtime companion packages separately:

```bash
pi install npm:@juicesharp/rpiv-todo
pi install npm:pi-subagents
```

- `@juicesharp/rpiv-todo` provides the `todo` tool used in place of canonical Superpowers task tracking guidance.
- `pi-subagents` provides the `subagent` tool used for delegated implementation and review workflows.

## Installation

```bash
pi install npm:@casualjim/pi-superpowers
```

You can also install directly from git:

```bash
pi install git:github.com/casualjim/pi-superpowers
```

For project-local installation, use Pi's local package install mode from your project so package settings stay with the repository.

## What This Package Provides

- Mandatory Superpowers bootstrap injection.
- Canonical Superpowers skills adapted for Pi.
- Workflow monitor guardrails for phase, TDD, verification, and review reminders.
- Bundled read-only reviewer agent templates.

## Tool Mapping

- `TodoWrite` → `todo` from `@juicesharp/rpiv-todo`.
- `Task` / subagent workflow → `subagent` from `pi-subagents`.
- `Read` / `Write` / `Edit` / `Bash` → Pi `read` / `write` / `edit` / `bash`.

## Reviewer Agents

Canonical Superpowers review is read-only. This repo bundles reviewer templates in `agents/`:

- `agents/superpowers-spec-reviewer.md`
- `agents/superpowers-code-reviewer.md`

Users can copy those templates into their repository's `.pi/agents/` directory to customize reviewer behavior. Project agents have higher priority in `pi-subagents` discovery, so repository-local copies can override the bundled/default behavior without changing global configuration.

Use the `superpowers-spec-reviewer` and `superpowers-code-reviewer` reviewer contracts, not the builtin review-and-fix `reviewer` agent.

## Docker E2E Installation Recovery Test

The default test suite is unit/regression only:

```bash
npm test
```

A dedicated real-Pi Docker integration test proves installation recovery end-to-end. It is a mise task so your configured mise/fnox environment can provide `ZAI_API_KEY` without the test harness inspecting the secret:

```bash
mise run test:integration
```

This builds a Docker image that copies this repository into `/workspace/pi-superpowers`, installs the real Pi CLI, installs `npm:@thesethrose/pi-zai-provider`, uses `zai/glm-5-turbo`, and verifies the exact recovery commands for missing companion packages. The test assumes `ZAI_API_KEY` is provided by the caller and does not preflight or debug secrets.

`fnox.toml` and `mise.toml` are committed for local secret/tool environment setup, but `.dockerignore` excludes them from the Docker build context.

## Architecture

`pi-superpowers` owns Superpowers behavior injection, Pi-adapted Superpowers skills, bundled reviewer templates, and workflow-monitor guardrails. It does not implement its own task tracker or subagent runtime; those are provided by the companion packages above.
