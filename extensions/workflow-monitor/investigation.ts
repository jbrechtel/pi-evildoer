export type InvestigationEvent =
  | { kind: "read"; path: string }
  | { kind: "search"; pattern: string }
  | { kind: "command"; command: string }
  | { kind: "source-write"; path: string };

export interface InvestigationState {
  readCount: number;
  searchCount: number;
  diagnosticCommandCount: number;
  hasInvestigation: boolean;
}

export function createInvestigationState(): InvestigationState {
  return {
    readCount: 0,
    searchCount: 0,
    diagnosticCommandCount: 0,
    hasInvestigation: false,
  };
}

export function nextInvestigationState(state: InvestigationState, event: InvestigationEvent): InvestigationState {
  const next = { ...state };
  if (event.kind === "read") next.readCount += 1;
  if (event.kind === "search") next.searchCount += 1;
  if (event.kind === "command" && /(?:test|grep|rg|find|npm|cargo|pytest|go test)/.test(event.command)) {
    next.diagnosticCommandCount += 1;
  }
  next.hasInvestigation = next.readCount > 0 || next.searchCount > 0 || next.diagnosticCommandCount > 0;
  return next;
}
