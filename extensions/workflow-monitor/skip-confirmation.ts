import { WORKFLOW_PHASES, type WorkflowPhase } from "./workflow-tracker.ts";

export interface PhaseSkipState {
  currentPhase?: WorkflowPhase | null;
  completedPhases?: readonly WorkflowPhase[];
  skippedPhases?: readonly WorkflowPhase[];
}

export function unresolvedPhasesBefore(targetPhase: WorkflowPhase, state: PhaseSkipState): WorkflowPhase[] {
  const targetIndex = WORKFLOW_PHASES.indexOf(targetPhase);
  if (targetIndex <= 0) return [];

  const completed = new Set(state.completedPhases ?? []);
  const skipped = new Set(state.skippedPhases ?? []);
  const current = state.currentPhase ?? null;

  return WORKFLOW_PHASES.slice(0, targetIndex).filter(
    (phase) => phase !== current && !completed.has(phase) && !skipped.has(phase),
  );
}

export function needsSkipConfirmation(targetPhase: WorkflowPhase, state: PhaseSkipState): boolean {
  return unresolvedPhasesBefore(targetPhase, state).length > 0;
}
