import type { WorkflowPhase } from "./workflow-tracker.ts";

export interface BoundaryPromptOption {
  label: string;
  prefill?: string;
  action: "continue" | "fresh-session" | "skip" | "cancel";
}

export interface BoundaryPrompt {
  from: string;
  to: WorkflowPhase;
  title: string;
  options: BoundaryPromptOption[];
}

function options(nextSkill: string, phase: WorkflowPhase, artifact?: string): BoundaryPromptOption[] {
  const artifactSuffix = artifact ? ` ${artifact}` : "";
  return [
    { label: "Continue in current session", action: "continue", prefill: `/skill:${nextSkill}${artifactSuffix}` },
    { label: "Start fresh session", action: "fresh-session", prefill: `/workflow-next ${phase}${artifactSuffix}` },
    { label: "Skip", action: "skip" },
    { label: "Discuss/cancel", action: "cancel" },
  ];
}

export const WORKFLOW_BOUNDARY_PROMPTS: Record<string, BoundaryPrompt> = {
  "design-written": {
    from: "design written",
    to: "plan",
    title: "Design written. Move to implementation planning?",
    options: options("writing-plans", "plan"),
  },
  "plan-written": {
    from: "plan written",
    to: "execute",
    title: "Plan written. Execute it?",
    options: options("executing-plans", "execute"),
  },
  "execution-complete": {
    from: "execution complete",
    to: "verify",
    title: "Execution complete. Verify before completion?",
    options: options("verification-before-completion", "verify"),
  },
  "verification-passed": {
    from: "verification passed",
    to: "review",
    title: "Verification passed. Request code review?",
    options: options("requesting-code-review", "review"),
  },
  "review-complete": {
    from: "review complete",
    to: "finish",
    title: "Review complete. Finish development branch?",
    options: options("finishing-a-development-branch", "finish"),
  },
};

export function buildWorkflowNextPrefill(phase: WorkflowPhase, artifact?: string): string {
  return [`/skill:${phase}`, artifact ? `Artifact: ${artifact}` : undefined].filter(Boolean).join("\n\n");
}
