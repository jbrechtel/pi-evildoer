export const WORKFLOW_PHASES = ["brainstorm", "plan", "execute", "verify", "review", "finish"] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

export const SKILL_TO_PHASE = {
  brainstorming: "brainstorm",
  "writing-plans": "plan",
  "executing-plans": "execute",
  "subagent-driven-development": "execute",
  "verification-before-completion": "verify",
  "requesting-code-review": "review",
  "finishing-a-development-branch": "finish",
} as const satisfies Record<string, WorkflowPhase>;

export type WorkflowSkillName = keyof typeof SKILL_TO_PHASE;

const SKILL_PATTERN = /(?:\/skill:|\bskill:|\bsuperpowers:)([a-z0-9-]+)/i;

export function parseSkillName(input: string): string | null {
  return input.match(SKILL_PATTERN)?.[1] ?? null;
}

export function phaseForSkill(input: string): WorkflowPhase | null {
  const skill = parseSkillName(input);
  if (!skill) return null;
  return SKILL_TO_PHASE[skill as WorkflowSkillName] ?? null;
}
