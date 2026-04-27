import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import workflowMonitorExtension from "../extensions/workflow-monitor.ts";

function renderWidget(widget: unknown): string {
  assert.equal(typeof widget, "function");
  const theme = {
    fg(color: string, text: string) {
      return `<${color}>${text}</${color}>`;
    },
    bold(text: string) {
      return `<bold>${text}</bold>`;
    },
  };
  const rendered = (widget as Function)(null, theme);
  return String(rendered?.text ?? rendered ?? "");
}

function createHarness(existingEntries: any[] = []) {
  const handlers = new Map<string, Function[]>();
  const commands = new Map<string, any>();
  const appended: any[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const widgets: Record<string, unknown> = {};
  let editorText = "";
  let newSessionOptions: any = null;

  const ctx: any = {
    ui: {
      setWidget(id: string, value: unknown) {
        widgets[id] = value;
      },
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      setEditorText(text: string) {
        editorText = text;
      },
    },
    sessionManager: {
      getBranch() {
        return [...existingEntries, ...appended];
      },
      getSessionFile() {
        return "/tmp/session.json";
      },
    },
    async newSession(options: any) {
      newSessionOptions = options;
      await options.withSession(ctx);
    },
  };

  const pi: any = {
    on(name: string, handler: Function) {
      const list = handlers.get(name) ?? [];
      list.push(handler);
      handlers.set(name, list);
    },
    registerCommand(name: string, command: any) {
      commands.set(name, command);
    },
    appendEntry(customType: string, data: unknown) {
      appended.push({ type: "custom", customType, data });
    },
  };

  workflowMonitorExtension(pi);

  async function emit(name: string, event: any = {}) {
    let result: any;
    for (const handler of handlers.get(name) ?? []) {
      result = await handler(event, ctx);
    }
    return result;
  }

  return { emit, ctx, commands, appended, notifications, widgets, get editorText() { return editorText; }, get newSessionOptions() { return newSessionOptions; } };
}

test("extension renders the pi-superpowers-plus phase strip contract", async () => {
  const harness = createHarness();
  await harness.emit("input", { text: "/skill:brainstorming" });

  assert.equal(harness.appended.length, 1);
  assert.equal(
    renderWidget(harness.widgets["pi-superpowers-workflow"]),
    [
      "<accent>[brainstorm]</accent>",
      "<dim>plan</dim>",
      "<dim>execute</dim>",
      "<dim>verify</dim>",
      "<dim>review</dim>",
      "<dim>finish</dim>",
    ].join("<dim> → </dim>"),
  );

  await harness.emit("tool_result", { toolName: "write", input: { path: "docs/specs/example-design.md" }, isError: false });
  assert.equal(harness.appended.at(-1).data.workflow.artifacts.brainstorm, "docs/specs/example-design.md");
});

test("extension observes todo and pi-subagents tools", async () => {
  const harness = createHarness();
  await harness.emit("input", { text: "/skill:writing-plans" });
  await harness.emit("tool_call", { toolName: "todo", input: { action: "create", subject: "Implement Task 1" } });
  assert.equal(harness.appended.at(-1).data.workflow.currentPhase, "execute");
  assert.equal(
    renderWidget(harness.widgets["pi-superpowers-workflow"]),
    [
      "<dim>brainstorm</dim>",
      "<success>✓plan</success>",
      "<accent>[execute]</accent>",
      "<dim>verify</dim>",
      "<dim>review</dim>",
      "<dim>finish</dim>",
    ].join("<dim> → </dim>"),
  );

  await harness.emit("tool_call", { toolName: "subagent", input: { agent: "superpowers-code-reviewer", task: "Review" } });
  assert.equal(harness.appended.at(-1).data.workflow.currentPhase, "review");
});


test("extension widget uses the pi-superpowers-plus guardrail highlighting contract", async () => {
  const harness = createHarness();
  await harness.emit("tool_result", { toolName: "write", input: { path: "tests/widget.test.ts" }, isError: false });
  assert.match(renderWidget(harness.widgets["pi-superpowers-workflow"]), /<error>TDD: RED-PENDING<\/error>/);

  await harness.emit("tool_result", { toolName: "bash", input: { command: "npm test" }, content: "FAIL", details: { exitCode: 1 } });
  assert.match(renderWidget(harness.widgets["pi-superpowers-workflow"]), /<error>TDD: RED<\/error>/);

  await harness.emit("tool_result", { toolName: "write", input: { path: "src/widget.ts" }, isError: false });
  await harness.emit("tool_result", { toolName: "bash", input: { command: "npm test" }, content: "FAIL", details: { exitCode: 1 } });
  await harness.emit("tool_result", { toolName: "write", input: { path: "src/widget.ts" }, isError: false });
  await harness.emit("tool_result", { toolName: "bash", input: { command: "npm test" }, content: "FAIL", details: { exitCode: 1 } });
  assert.match(renderWidget(harness.widgets["pi-superpowers-workflow"]), /<warning>Debug: 2 fix attempts<\/warning>/);
  assert.match(renderWidget(harness.widgets["pi-superpowers-workflow"]), /<dim>  \|  <\/dim>/);
});

test("extension widget does not show idle TDD or investigation-only debug", async () => {
  const harness = createHarness();
  await harness.emit("tool_result", { toolName: "write", input: { path: "src/source-only.ts" }, isError: false });
  assert.doesNotMatch(renderWidget(harness.widgets["pi-superpowers-workflow"]), /TDD: RED-PENDING/);

  const debugHarness = createHarness();
  await debugHarness.emit("tool_result", { toolName: "read", input: { path: "src/source-only.ts" }, content: "" });
  assert.equal(debugHarness.widgets["pi-superpowers-workflow"], undefined);
});

test("extension emits branch safety reminder per reconstructed workflow", async () => {
  const harness = createHarness();
  await harness.emit("tool_result", { toolName: "write", input: { path: "README.md" }, isError: false });
  assert.match(harness.notifications.map((item) => item.message).join("\n"), /branch safety/i);

  const count = harness.notifications.length;
  await harness.emit("tool_result", { toolName: "write", input: { path: "README.md" }, isError: false });
  assert.equal(harness.notifications.length, count);

  await harness.emit("session_start", {});
  await harness.emit("tool_result", { toolName: "write", input: { path: "README.md" }, isError: false });
  assert.equal(harness.notifications.length, count + 1);
});

test("extension blocks thinking-phase source writes and stale completion commands", async () => {
  const harness = createHarness();
  await harness.emit("input", { text: "/skill:brainstorming" });
  const blockedWrite = await harness.emit("tool_call", { toolName: "write", input: { path: "src/index.ts" } });
  assert.equal(blockedWrite.block, true);
  assert.match(blockedWrite.reason, /docs\/specs\/ and docs\/plans\//);

  await harness.emit("input", { text: "/skill:executing-plans" });
  assert.equal(await harness.emit("tool_call", { toolName: "bash", input: { command: "git commit -m test" } }), undefined);

  await harness.emit("tool_result", { toolName: "write", input: { path: "src/index.ts" }, isError: false });
  assert.match(harness.notifications.at(-1)?.message ?? "", /failing test/);
  const blockedCommit = await harness.emit("tool_call", { toolName: "bash", input: { command: "git commit -m test" } });
  assert.equal(blockedCommit.block, true);
  assert.match(blockedCommit.reason, /fresh passing test\/verification command/);
});

test("workflow commands reset state and prefill fresh sessions", async () => {
  const harness = createHarness();
  await harness.emit("input", { text: "/skill:writing-plans" });

  await harness.commands.get("workflow-reset").handler("", harness.ctx);
  assert.equal(harness.appended.at(-1).data.workflow.currentPhase, null);

  await harness.commands.get("workflow-next").handler("execute docs/plans/example.md", harness.ctx);
  assert.equal(harness.newSessionOptions.parentSession, "/tmp/session.json");
  assert.match(harness.editorText, /Continue from artifact: docs\/plans\/example\.md/);
  assert.match(harness.editorText, /executing-plans|subagent-driven-development/);
});

test("extension resets handler when branch has no persisted workflow state", async () => {
  const harness = createHarness();
  await harness.emit("input", { text: "/skill:writing-plans" });
  assert.equal(harness.appended.at(-1).data.workflow.currentPhase, "plan");

  harness.appended.length = 0;
  await harness.emit("session_tree", {});
  const widget = harness.widgets["pi-superpowers-workflow"];
  assert.equal(widget, undefined);
});

test("extension source avoids forbidden plus-only workflow components", () => {
  const roots = ["extensions", "skills", "agents"];
  const files: string[] = [];

  function collect(dir: string) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) collect(path);
      else if (/\.(?:ts|md)$/.test(path)) files.push(path);
    }
  }

  for (const root of roots) collect(root);

  const allow = new Set<string>();
  const forbidden = [/plan_tracker/, /workflow_reference/, /extensions\/plan-tracker/, /extensions\/subagent/, /agent:\s*[\"']code-reviewer[\"']/, /agent:\s*[\"']spec-reviewer[\"']/];

  const offenders = files.flatMap((file) => {
    if (allow.has(file)) return [];
    const text = readFileSync(file, "utf8");
    return forbidden.some((pattern) => pattern.test(text)) ? [file] : [];
  });

  assert.deepEqual(offenders, []);
});
