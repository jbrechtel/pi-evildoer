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

## Architecture

`pi-superpowers` owns Superpowers behavior injection, Pi-adapted Superpowers skills, bundled reviewer templates, and workflow-monitor guardrails. It does not implement its own task tracker or subagent runtime; those are provided by the companion packages above.
