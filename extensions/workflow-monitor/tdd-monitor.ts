export type TddStatus = "RED-PENDING" | "RED" | "GREEN" | "REFACTOR";

export type TddEvent =
  | { kind: "test-write"; path: string }
  | { kind: "source-write"; path: string }
  | { kind: "test-run"; command: string; exitCode: number };

export interface TddState {
  status: TddStatus;
  hasTestChange: boolean;
  hasSourceChange: boolean;
  lastTestCommand: string | null;
  lastTestExitCode: number | null;
}

export function createTddState(): TddState {
  return {
    status: "RED-PENDING",
    hasTestChange: false,
    hasSourceChange: false,
    lastTestCommand: null,
    lastTestExitCode: null,
  };
}

export function nextTddState(state: TddState, event: TddEvent): TddState {
  const next = { ...state };
  switch (event.kind) {
    case "test-write":
      next.hasTestChange = true;
      if (next.status === "GREEN") next.status = "REFACTOR";
      return next;
    case "source-write":
      next.hasSourceChange = true;
      if (next.status === "GREEN") next.status = "REFACTOR";
      return next;
    case "test-run":
      next.lastTestCommand = event.command;
      next.lastTestExitCode = event.exitCode;
      if (event.exitCode === 0) {
        next.status = next.hasSourceChange ? "GREEN" : next.status;
      } else if (next.hasTestChange) {
        next.status = "RED";
      }
      return next;
  }
}

export function tddWarningsForEvent(state: TddState, event: TddEvent): string[] {
  if (event.kind === "source-write" && state.status === "RED-PENDING" && !state.hasTestChange) {
    return ["Write or update a failing test before changing source code."];
  }
  return [];
}
