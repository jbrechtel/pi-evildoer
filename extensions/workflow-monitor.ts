import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { createWorkflowHandler, type WorkflowMonitorState } from "./workflow-monitor/workflow-handler.ts";
import { getCurrentGitRef } from "./workflow-monitor/git.ts";
import { warningForViolation } from "./workflow-monitor/warnings.ts";
import { WORKFLOW_PHASES, type WorkflowPhase } from "./workflow-monitor/workflow-tracker.ts";
import { buildWorkflowNextPrefill } from "./workflow-monitor/workflow-transitions.ts";

const STATE_ENTRY_TYPE = "pi-superpowers-workflow-state";

function branchEntries(ctx: ExtensionContext): any[] {
  const manager = ctx.sessionManager as any;
  if (typeof manager.getBranch === "function") return manager.getBranch();
  if (typeof manager.getEntries === "function") return manager.getEntries();
  return [];
}

function latestState(ctx: ExtensionContext): WorkflowMonitorState | null {
  const entries = branchEntries(ctx);
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type === "custom" && entry.customType === STATE_ENTRY_TYPE && entry.data) {
      return entry.data as WorkflowMonitorState;
    }
  }
  return null;
}

function pathFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as { path?: unknown; filePath?: unknown }).path ?? (input as { filePath?: unknown }).filePath;
  return typeof value === "string" ? value : undefined;
}

function refreshWidget(ctx: ExtensionContext, state: WorkflowMonitorState): void {
  const strip = WORKFLOW_PHASES.map((phase) => {
    const status = state.workflow.phases[phase];
    if (state.workflow.currentPhase === phase) return `[${phase}]`;
    if (status === "complete") return `✓${phase}`;
    if (status === "skipped") return `–${phase}`;
    return phase;
  }).join("  ");
  const lines = [strip];
  if (state.tdd.status !== "RED-PENDING") lines.push(`TDD: ${state.tdd.status}`);
  if (state.debugMode) lines.push("Debug: active");
  if (state.sourceEditedSinceVerification) lines.push("verification stale");
  ctx.ui.setWidget("pi-superpowers-workflow", lines);
}

function persist(pi: ExtensionAPI, ctx: ExtensionContext, handler: ReturnType<typeof createWorkflowHandler>): void {
  const state = handler.getFullState();
  pi.appendEntry(STATE_ENTRY_TYPE, state);
  refreshWidget(ctx, state);
}

function parseWorkflowNextArgs(args: string): { phase: WorkflowPhase; artifact?: string } | null {
  const [phaseRaw, ...rest] = args.trim().split(/\s+/).filter(Boolean);
  if (!phaseRaw || !WORKFLOW_PHASES.includes(phaseRaw as WorkflowPhase)) return null;
  return { phase: phaseRaw as WorkflowPhase, artifact: rest.join(" ") || undefined };
}

export default function (pi: ExtensionAPI) {
  const handler = createWorkflowHandler();
  let branchReminderSent = false;

  function notifyBranchSafety(ctx: ExtensionContext): void {
    if (branchReminderSent) return;
    branchReminderSent = true;
    const ref = getCurrentGitRef() ?? "git ref unavailable";
    ctx.ui.notify(`Superpowers branch safety: first write in this session on ${ref}. Confirm this is the intended branch/worktree.`, "warning");
  }

  function reconstruct(ctx: ExtensionContext): void {
    branchReminderSent = false;
    const state = latestState(ctx);
    if (state) handler.setFullState(state);
    else handler.resetState();
    refreshWidget(ctx, handler.getFullState());
  }

  pi.on("session_start", async (_event, ctx) => reconstruct(ctx));
  pi.on("session_tree", async (_event, ctx) => reconstruct(ctx));
  pi.on("session_compact", async (_event, ctx) => reconstruct(ctx));
  pi.on("session_shutdown", async (_event, ctx) => refreshWidget(ctx, handler.getFullState()));

  pi.on("input", async (event: any, ctx) => {
    const text = String(event?.text ?? event?.input ?? event?.prompt ?? "");
    const result = handler.handleInputText(text);
    if (result.changed) persist(pi, ctx, handler);
  });

  pi.on("tool_call", async (event: any, ctx) => {
    const result = handler.handleToolCall(event.toolName, event.input);
    if (result.violation) {
      const reason = warningForViolation(result.violation);
      ctx.ui.notify(reason, "warning");
      return { block: true, reason };
    }
    if (result.changed) persist(pi, ctx, handler);
  });

  pi.on("tool_result", async (event: any, ctx) => {
    let changed = false;

    if ((event.toolName === "write" || event.toolName === "edit") && !event.isError) {
      const path = pathFromInput(event.input);
      if (path) {
        notifyBranchSafety(ctx);
        const result = handler.handleFileWritten(path);
        changed = result.changed || changed;
        if (result.violation) ctx.ui.notify(warningForViolation(result.violation), "warning");
      }
    }

    changed = handler.handleToolResult(event.toolName, event.input, event).changed || changed;

    if (changed) persist(pi, ctx, handler);
  });

  pi.on("agent_end", async (_event, ctx) => {
    refreshWidget(ctx, handler.getFullState());
  });

  pi.registerCommand("workflow-reset", {
    description: "Reset pi-superpowers workflow monitor state",
    handler: async (_args, ctx) => {
      branchReminderSent = false;
      handler.resetState();
      persist(pi, ctx, handler);
      ctx.ui.notify("Superpowers workflow state reset", "info");
    },
  });

  pi.registerCommand("workflow-next", {
    description: "Start or prefill the next Superpowers workflow phase",
    handler: async (args, ctx) => {
      const parsed = parseWorkflowNextArgs(args);
      if (!parsed) {
        ctx.ui.notify(`Usage: /workflow-next <${WORKFLOW_PHASES.join("|")}> [artifact]`, "error");
        return;
      }

      const parentSession = ctx.sessionManager.getSessionFile?.();
      await ctx.newSession({
        parentSession,
        withSession: async (nextCtx) => {
          nextCtx.ui.setEditorText(buildWorkflowNextPrefill(parsed.phase, parsed.artifact));
        },
      });
    },
  });
}
