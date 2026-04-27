export type VerificationStatus = "none" | "fresh" | "stale" | "failed";

export type VerificationEvent =
  | { kind: "test-run"; command: string; exitCode: number }
  | { kind: "source-write"; path: string }
  | { kind: "command"; command: string };

export interface VerificationState {
  status: VerificationStatus;
  lastCommand: string | null;
  lastExitCode: number | null;
  hasSourceEditSinceVerification: boolean;
}

export function createVerificationState(): VerificationState {
  return {
    status: "none",
    lastCommand: null,
    lastExitCode: null,
    hasSourceEditSinceVerification: false,
  };
}

export function nextVerificationState(state: VerificationState, event: VerificationEvent): VerificationState {
  const next = { ...state };
  if (event.kind === "test-run") {
    next.lastCommand = event.command;
    next.lastExitCode = event.exitCode;
    next.status = event.exitCode === 0 ? "fresh" : "failed";
    if (event.exitCode === 0) next.hasSourceEditSinceVerification = false;
  }
  if (event.kind === "source-write") {
    next.hasSourceEditSinceVerification = true;
    next.status = "stale";
  }
  return next;
}

export function verificationWarningsForEvent(state: VerificationState, event: VerificationEvent): string[] {
  if (event.kind !== "command") return [];
  const command = event.command.trim();
  const gated = command.startsWith("git commit")
    ? "git commit"
    : command.startsWith("git push")
      ? "git push"
      : command.startsWith("gh pr create")
        ? "gh pr create"
        : null;
  if (!gated) return [];
  if (state.hasSourceEditSinceVerification) return [`Run fresh verification before ${gated}.`];
  return [];
}
