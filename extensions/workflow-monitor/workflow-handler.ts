import { isAllowedThinkingPhaseWrite, isSourceFile, isTestFile } from "./heuristics.ts";
import { parseTestCommand, parseTestResult, testCommandKind } from "./test-runner.ts";
import {
  createDebugState,
  debugWarningsForEvent,
  nextDebugState,
  type DebugState,
} from "./debug-monitor.ts";
import {
  createInvestigationState,
  nextInvestigationState,
  type InvestigationState,
} from "./investigation.ts";
import {
  createTddState,
  nextTddState,
  tddWarningsForEvent,
  type TddState,
} from "./tdd-monitor.ts";
import {
  createVerificationState,
  nextVerificationState,
  verificationWarningsForEvent,
  type VerificationState,
} from "./verification-monitor.ts";
import { WorkflowTracker, type WorkflowPhase, type WorkflowTrackerState } from "./workflow-tracker.ts";

export type WorkflowViolationType =
  | "process-write-during-thinking"
  | "source-before-failing-test"
  | "fix-before-investigation"
  | "repeated-fix-failures"
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
  warnings?: string[];
}

export interface WorkflowMonitorState {
  // Compatibility summary fields used by the first runtime implementation.
  phase: WorkflowPhase | null;
  sourceEditedSinceVerification: boolean;
  lastSourceEditAt: number | null;
  lastVerificationAt: number | null;
  consecutiveFailingTests: number;
  debugMode: boolean;
  completedPhases: WorkflowPhase[];

  // Full monitor state.
  workflow: WorkflowTrackerState;
  tdd: TddState;
  debug: DebugState;
  investigation: InvestigationState;
  verification: VerificationState;
}

function initialState(): WorkflowMonitorState {
  const workflow = new WorkflowTracker().getState();
  return {
    phase: null,
    sourceEditedSinceVerification: false,
    lastSourceEditAt: null,
    lastVerificationAt: null,
    consecutiveFailingTests: 0,
    debugMode: false,
    completedPhases: [],
    workflow,
    tdd: createTddState(),
    debug: createDebugState(),
    investigation: createInvestigationState(),
    verification: createVerificationState(),
  };
}

function cloneState(state: WorkflowMonitorState): WorkflowMonitorState {
  return {
    ...state,
    completedPhases: [...state.completedPhases],
    workflow: {
      phases: { ...state.workflow.phases },
      currentPhase: state.workflow.currentPhase,
      artifacts: { ...state.workflow.artifacts },
      prompted: { ...state.workflow.prompted },
    },
    tdd: { ...state.tdd },
    debug: { ...state.debug },
    investigation: { ...state.investigation },
    verification: { ...state.verification },
  };
}

function mergeState(nextState?: Partial<WorkflowMonitorState>): WorkflowMonitorState {
  const base = initialState();
  if (!nextState) return base;
  return cloneState({
    ...base,
    ...nextState,
    completedPhases: nextState.completedPhases ? [...nextState.completedPhases] : base.completedPhases,
    workflow: nextState.workflow ? { ...base.workflow, ...nextState.workflow } : base.workflow,
    tdd: nextState.tdd ? { ...base.tdd, ...nextState.tdd } : base.tdd,
    debug: nextState.debug ? { ...base.debug, ...nextState.debug } : base.debug,
    investigation: nextState.investigation ? { ...base.investigation, ...nextState.investigation } : base.investigation,
    verification: nextState.verification ? { ...base.verification, ...nextState.verification } : base.verification,
  });
}

function filePathFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as { path?: unknown; filePath?: unknown }).path ?? (input as { filePath?: unknown }).filePath;
  return typeof value === "string" ? value : undefined;
}

function commandFromInput(input: unknown): string | undefined {
  return typeof (input as { command?: unknown } | undefined)?.command === "string"
    ? ((input as { command: string }).command)
    : undefined;
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

function violationTypeForCommand(command: string): WorkflowViolationType | null {
  if (/\bgit\s+commit\b/.test(command)) return "commit-without-verification";
  if (/\bgit\s+push\b/.test(command)) return "push-without-verification";
  if (/\bgh\s+pr\s+create\b/.test(command)) return "pr-without-verification";
  return null;
}

function updateWorkflowSummary(state: WorkflowMonitorState): void {
  state.phase = state.workflow.currentPhase;
  state.completedPhases = Object.entries(state.workflow.phases)
    .filter(([, status]) => status === "complete")
    .map(([phase]) => phase as WorkflowPhase);
  state.sourceEditedSinceVerification = state.verification.hasSourceEditSinceVerification;
  state.debugMode = state.debug.failedFixAttempts >= 2;
}

export function createWorkflowHandler(initial?: Partial<WorkflowMonitorState>) {
  let state = mergeState(initial);
  const tracker = new WorkflowTracker();
  tracker.setState(state.workflow);

  function syncFromTracker(): void {
    state.workflow = tracker.getState();
    updateWorkflowSummary(state);
  }

  function sourceViolationFor(path: string): WorkflowViolation | undefined {
    const debugWarningText = state.debug.failedFixAttempts > 0 || state.investigation.hasInvestigation
      ? debugWarningsForEvent(state.debug, { kind: "source-write", path })[0]
      : undefined;
    if (debugWarningText && !debugWarningText.startsWith("Investigate")) {
      return { type: "repeated-fix-failures", path, message: debugWarningText };
    }

    const tddWarningText = tddWarningsForEvent(state.tdd, { kind: "source-write", path })[0];
    if (tddWarningText) return { type: "source-before-failing-test", path, message: tddWarningText };

    if (debugWarningText) return { type: "fix-before-investigation", path, message: debugWarningText };
    return undefined;
  }

  function applyFileWritten(filePath: string): WorkflowHandlerResult {
    let changed = tracker.onFileWritten(filePath);
    syncFromTracker();

    if (isTestFile(filePath)) {
      state.tdd = nextTddState(state.tdd, { kind: "test-write", path: filePath });
      changed = true;
    }

    if (!isSourceFile(filePath)) return { changed };

    const violation = sourceViolationFor(filePath);
    state.tdd = nextTddState(state.tdd, { kind: "source-write", path: filePath });
    state.debug = nextDebugState(state.debug, { kind: "source-write", path: filePath });
    state.verification = nextVerificationState(state.verification, { kind: "source-write", path: filePath });
    state.lastSourceEditAt = Date.now();
    state.lastVerificationAt = null;
    updateWorkflowSummary(state);
    return { changed: true, violation };
  }

  function applyCommand(command: string, output: string, exitCode?: number | null): WorkflowHandlerResult {
    let changed = false;
    const kind = testCommandKind(command);
    if (kind) {
      const passed = parseTestResult(output, exitCode);
      if (passed !== null) {
        state.verification = nextVerificationState(state.verification, { kind: "test-run", command, exitCode: passed ? 0 : 1 });
        if (kind === "test") {
          state.tdd = nextTddState(state.tdd, { kind: "test-run", command, exitCode: passed ? 0 : 1 });
          state.debug = nextDebugState(state.debug, { kind: "test-run", command, exitCode: passed ? 0 : 1 });
          state.consecutiveFailingTests = passed ? 0 : state.consecutiveFailingTests + 1;
        }
        if (passed) state.lastVerificationAt = Date.now();
        changed = true;
      }
    }

    if (/\b(?:rg|grep|find)\b/.test(command)) {
      state.investigation = nextInvestigationState(state.investigation, { kind: "command", command });
      state.debug = nextDebugState(state.debug, { kind: "search", pattern: command });
      changed = true;
    }

    updateWorkflowSummary(state);
    return { changed };
  }

  return {
    handleInputText(text: string): WorkflowHandlerResult {
      const changed = tracker.onInputText(text);
      syncFromTracker();
      return { changed };
    },

    handleToolCall(toolName: string, input: unknown): WorkflowHandlerResult {
      if ((toolName === "write" || toolName === "edit") && (state.workflow.currentPhase === "brainstorm" || state.workflow.currentPhase === "plan")) {
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

      if (toolName === "todo" && input && typeof input === "object") {
        const changed = tracker.onTodoToolCall(input as Record<string, unknown>);
        syncFromTracker();
        return { changed };
      }

      if (toolName === "subagent" && input && typeof input === "object") {
        const changed = tracker.onSubagentToolCall(input as Record<string, unknown>);
        syncFromTracker();
        return { changed };
      }

      if (toolName === "bash") {
        const command = commandFromInput(input);
        if (command) {
          const violation = this.checkCommitGate(command);
          if (violation) return { changed: false, violation };
        }
      }

      return { changed: false };
    },

    handleFileWritten(filePath: string): WorkflowHandlerResult {
      return applyFileWritten(filePath);
    },

    handleTestCommand(command: string, output: string, exitCode?: number | null): WorkflowHandlerResult {
      if (!parseTestCommand(command) && testCommandKind(command) !== "verification") return { changed: false };
      return applyCommand(command, output, exitCode);
    },

    handleToolResult(toolName: string, input: unknown, result: { content?: unknown; details?: unknown; isError?: boolean }): WorkflowHandlerResult {
      if (toolName === "todo") {
        const changed = tracker.onTodoToolResult(result.details);
        syncFromTracker();
        return { changed };
      }

      if (toolName === "subagent" && input && typeof input === "object") {
        const changed = tracker.onSubagentToolCall(input as Record<string, unknown>);
        syncFromTracker();
        return { changed };
      }

      if (toolName === "read") {
        const path = filePathFromInput(input);
        if (!path) return { changed: false };
        const changed = tracker.onSkillFileRead(path);
        state.investigation = nextInvestigationState(state.investigation, { kind: "read", path });
        state.debug = nextDebugState(state.debug, { kind: "read", path });
        syncFromTracker();
        updateWorkflowSummary(state);
        return { changed: true };
      }

      if (toolName !== "bash") return { changed: false };
      const command = commandFromInput(input);
      if (!command) return { changed: false };
      const detailsExitCode = (result.details as { exitCode?: unknown; code?: unknown } | undefined)?.exitCode
        ?? (result.details as { code?: unknown } | undefined)?.code;
      const exitCode = typeof detailsExitCode === "number" ? detailsExitCode : result.isError ? 1 : null;
      return applyCommand(command, textFromResultContent(result.content), exitCode);
    },

    checkCommitGate(command: string): WorkflowViolation | undefined {
      const type = violationTypeForCommand(command);
      if (!type) return undefined;
      const message = verificationWarningsForEvent(state.verification, { kind: "command", command })[0];
      if (!message) return undefined;
      return { type, command, message };
    },

    getFullState(): WorkflowMonitorState {
      syncFromTracker();
      return cloneState(state);
    },

    setFullState(nextState: WorkflowMonitorState): void {
      state = mergeState(nextState);
      tracker.setState(state.workflow);
      syncFromTracker();
    },

    resetState(): void {
      state = initialState();
      tracker.reset();
      syncFromTracker();
    },
  };
}
