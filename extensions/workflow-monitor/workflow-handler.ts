import { isAllowedThinkingPhaseWrite, isSourceFile } from "./heuristics.ts";
import { parseTestCommand, parseTestResult } from "./test-runner.ts";
import { phaseForSkill, type WorkflowPhase } from "./workflow-tracker.ts";

export type WorkflowViolationType =
  | "process-write-during-thinking"
  | "commit-without-verification"
  | "push-without-verification"
  | "pr-without-verification";

export interface WorkflowViolation {
  type: WorkflowViolationType;
  message: string;
  command?: string;
  path?: string;
}

export interface WorkflowHandlerResult {
  changed: boolean;
  violation?: WorkflowViolation;
}

export interface WorkflowMonitorState {
  phase: WorkflowPhase | null;
  sourceEditedSinceVerification: boolean;
  lastSourceEditAt: number | null;
  lastVerificationAt: number | null;
  consecutiveFailingTests: number;
  debugMode: boolean;
  completedPhases: WorkflowPhase[];
}

const INITIAL_STATE: WorkflowMonitorState = {
  phase: null,
  sourceEditedSinceVerification: false,
  lastSourceEditAt: null,
  lastVerificationAt: null,
  consecutiveFailingTests: 0,
  debugMode: false,
  completedPhases: [],
};

function cloneState(state: WorkflowMonitorState): WorkflowMonitorState {
  return {
    ...state,
    completedPhases: [...state.completedPhases],
  };
}

function filePathFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as { path?: unknown; filePath?: unknown }).path ?? (input as { filePath?: unknown }).filePath;
  return typeof value === "string" ? value : undefined;
}

function textFromResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("\n");
}

function isCompletionCommand(command: string): WorkflowViolationType | null {
  if (/\bgit\s+commit\b/.test(command)) return "commit-without-verification";
  if (/\bgit\s+push\b/.test(command)) return "push-without-verification";
  if (/\bgh\s+pr\s+create\b/.test(command)) return "pr-without-verification";
  return null;
}

export function createWorkflowHandler(initialState?: Partial<WorkflowMonitorState>) {
  let state: WorkflowMonitorState = { ...cloneState(INITIAL_STATE), ...initialState };

  function setPhase(phase: WorkflowPhase): void {
    if (state.phase && state.phase !== phase && !state.completedPhases.includes(state.phase)) {
      state.completedPhases.push(state.phase);
    }
    state.phase = phase;
  }

  function staleVerification(): boolean {
    return state.sourceEditedSinceVerification && !state.lastVerificationAt;
  }

  return {
    handleInputText(text: string): WorkflowHandlerResult {
      const phase = phaseForSkill(text);
      if (!phase) return { changed: false };
      setPhase(phase);
      return { changed: true };
    },

    handleToolCall(toolName: string, input: unknown): WorkflowHandlerResult {
      if ((toolName === "write" || toolName === "edit") && (state.phase === "brainstorm" || state.phase === "plan")) {
        const path = filePathFromInput(input);
        if (path && !isAllowedThinkingPhaseWrite(path)) {
          return {
            changed: false,
            violation: {
              type: "process-write-during-thinking",
              path,
              message: "Brainstorm/Plan writes are limited to docs/specs/ and docs/plans/.",
            },
          };
        }
      }

      if (toolName === "bash") {
        const command = (input as { command?: unknown } | undefined)?.command;
        if (typeof command === "string") {
          const violation = this.checkCommitGate(command);
          if (violation) return { changed: false, violation };
        }
      }

      return { changed: false };
    },

    handleFileWritten(filePath: string): WorkflowHandlerResult {
      if (!isSourceFile(filePath)) return { changed: false };
      state.sourceEditedSinceVerification = true;
      state.lastSourceEditAt = Date.now();
      state.lastVerificationAt = null;
      return { changed: true };
    },

    handleTestCommand(command: string, output: string, exitCode?: number | null): WorkflowHandlerResult {
      if (!parseTestCommand(command)) return { changed: false };
      const passed = parseTestResult(output, exitCode);
      if (passed === null) return { changed: false };

      if (passed) {
        state.lastVerificationAt = Date.now();
        state.sourceEditedSinceVerification = false;
        state.consecutiveFailingTests = 0;
        state.debugMode = false;
      } else {
        state.consecutiveFailingTests += 1;
        state.debugMode = state.consecutiveFailingTests >= 2;
      }

      return { changed: true };
    },

    handleToolResult(toolName: string, input: unknown, result: { content?: unknown; details?: unknown; isError?: boolean }): WorkflowHandlerResult {
      if (toolName !== "bash") return { changed: false };
      const command = (input as { command?: unknown } | undefined)?.command;
      if (typeof command !== "string") return { changed: false };
      const detailsExitCode = (result.details as { exitCode?: unknown; code?: unknown } | undefined)?.exitCode
        ?? (result.details as { code?: unknown } | undefined)?.code;
      const exitCode = typeof detailsExitCode === "number" ? detailsExitCode : result.isError ? 1 : 0;
      return this.handleTestCommand(command, textFromResultContent(result.content), exitCode);
    },

    checkCommitGate(command: string): WorkflowViolation | undefined {
      const type = isCompletionCommand(command);
      if (!type || !staleVerification()) return undefined;
      return {
        type,
        command,
        message: `Command '${command}' requires fresh passing verification after source edits before completion.`,
      };
    },

    getFullState(): WorkflowMonitorState {
      return cloneState(state);
    },

    setFullState(nextState: WorkflowMonitorState): void {
      state = cloneState({ ...INITIAL_STATE, ...nextState });
    },

    resetState(): void {
      state = cloneState(INITIAL_STATE);
    },
  };
}
