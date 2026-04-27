export type DebugEvent =
  | { kind: "read"; path: string }
  | { kind: "search"; pattern: string }
  | { kind: "source-write"; path: string }
  | { kind: "test-run"; command: string; exitCode: number };

export interface DebugState {
  hasInvestigation: boolean;
  fixAttempts: number;
  failedFixAttempts: number;
  sourceChangedSinceRun: boolean;
}

export function createDebugState(): DebugState {
  return {
    hasInvestigation: false,
    fixAttempts: 0,
    failedFixAttempts: 0,
    sourceChangedSinceRun: false,
  };
}

export function nextDebugState(state: DebugState, event: DebugEvent): DebugState {
  const next = { ...state };
  switch (event.kind) {
    case "read":
    case "search":
      next.hasInvestigation = true;
      return next;
    case "source-write":
      next.fixAttempts += 1;
      next.sourceChangedSinceRun = true;
      return next;
    case "test-run":
      if (next.sourceChangedSinceRun && event.exitCode !== 0) next.failedFixAttempts += 1;
      if (event.exitCode === 0) next.failedFixAttempts = 0;
      next.sourceChangedSinceRun = false;
      return next;
  }
}

export function debugWarningsForEvent(state: DebugState, event: DebugEvent): string[] {
  if (event.kind !== "source-write") return [];
  if (state.failedFixAttempts >= 2) return ["Repeated fixes are failing; stop and re-investigate the root cause."];
  if (!state.hasInvestigation) return ["Investigate the root cause before changing source code."];
  return [];
}
