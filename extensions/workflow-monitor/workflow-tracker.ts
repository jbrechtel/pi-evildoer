export const WORKFLOW_PHASES = ["brainstorm", "plan", "execute", "verify", "review", "finish"] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];
export type Phase = WorkflowPhase;
export type PhaseStatus = "pending" | "active" | "complete" | "skipped";

export interface WorkflowTrackerState {
  phases: Record<WorkflowPhase, PhaseStatus>;
  currentPhase: WorkflowPhase | null;
  artifacts: Record<WorkflowPhase, string | null>;
  prompted: Record<WorkflowPhase, boolean>;
}

export type TransitionBoundary =
  | "design_committed"
  | "plan_ready"
  | "execution_complete"
  | "verification_passed"
  | "review_complete";

export const SKILL_TO_PHASE: Record<string, WorkflowPhase> = {
  brainstorming: "brainstorm",
  "writing-plans": "plan",
  "executing-plans": "execute",
  "subagent-driven-development": "execute",
  "verification-before-completion": "verify",
  "requesting-code-review": "review",
  "finishing-a-development-branch": "finish",
};

const SKILL_PATTERN = /(?:\/skill:|\bskill:|\bsuperpowers:)([a-z0-9-]+)/i;
const XML_SKILL_PATTERN = /<skill\s+name="([^"]+)"/i;
const CURRENT_DESIGN_RE = /^docs\/specs\/.*-design\.md$/;
const PLUS_LEGACY_DESIGN_RE = /^docs\/plans\/.*-design\.md$/;
const OBRA_DESIGN_RE = /^docs\/superpowers\/specs\/.*-design\.md$/;
const CURRENT_PLAN_RE = /^docs\/plans\/[^/]+\.md$/;
const OBRA_PLAN_RE = /^docs\/superpowers\/plans\/[^/]+\.md$/;

function emptyState(): WorkflowTrackerState {
  return {
    phases: Object.fromEntries(WORKFLOW_PHASES.map((phase) => [phase, "pending"])) as Record<WorkflowPhase, PhaseStatus>,
    currentPhase: null,
    artifacts: Object.fromEntries(WORKFLOW_PHASES.map((phase) => [phase, null])) as Record<WorkflowPhase, string | null>,
    prompted: Object.fromEntries(WORKFLOW_PHASES.map((phase) => [phase, false])) as Record<WorkflowPhase, boolean>,
  };
}

function cloneState(state: WorkflowTrackerState): WorkflowTrackerState {
  return {
    phases: { ...state.phases },
    currentPhase: state.currentPhase,
    artifacts: { ...state.artifacts },
    prompted: { ...state.prompted },
  };
}

function normalizePath(filePath: string): string {
  return filePath.replace(/^\.\//, "").replaceAll("\\", "/");
}

export function parseSkillName(text: string): string | null {
  return text.match(XML_SKILL_PATTERN)?.[1] ?? text.match(SKILL_PATTERN)?.[1] ?? null;
}

export function phaseForSkill(text: string): WorkflowPhase | null {
  const skill = parseSkillName(text);
  return skill ? SKILL_TO_PHASE[skill] ?? null : null;
}

export function computeBoundaryToPrompt(state: WorkflowTrackerState): TransitionBoundary | null {
  if (state.phases.brainstorm === "complete" && !state.prompted.brainstorm) return "design_committed";
  if (state.phases.plan === "complete" && !state.prompted.plan) return "plan_ready";
  if (state.phases.execute === "complete" && !state.prompted.execute) return "execution_complete";
  if (state.phases.verify === "complete" && !state.prompted.verify) return "verification_passed";
  if (state.phases.review === "complete" && !state.prompted.review) return "review_complete";
  return null;
}

export class WorkflowTracker {
  private state = emptyState();

  getState(): WorkflowTrackerState {
    return cloneState(this.state);
  }

  setState(state: WorkflowTrackerState): void {
    this.state = {
      ...emptyState(),
      ...cloneState(state),
      phases: { ...emptyState().phases, ...state.phases },
      artifacts: { ...emptyState().artifacts, ...state.artifacts },
      prompted: { ...emptyState().prompted, ...state.prompted },
    };
  }

  reset(): void {
    this.state = emptyState();
  }

  advanceTo(phase: WorkflowPhase): boolean {
    const current = this.state.currentPhase;
    const nextIndex = WORKFLOW_PHASES.indexOf(phase);

    if (current) {
      const currentIndex = WORKFLOW_PHASES.indexOf(current);
      if (nextIndex < currentIndex) {
        this.reset();
      } else if (nextIndex === currentIndex) {
        // Stay in the current phase without resetting artifacts or prompts.
      } else if (this.state.phases[current] === "active") {
        this.state.phases[current] = "complete";
      }
    }

    for (const workflowPhase of WORKFLOW_PHASES) {
      if (workflowPhase !== phase && this.state.phases[workflowPhase] === "active") {
        this.state.phases[workflowPhase] = "complete";
      }
    }

    this.state.currentPhase = phase;
    if (this.state.phases[phase] === "pending") this.state.phases[phase] = "active";
    return true;
  }

  skipPhase(phase: WorkflowPhase): boolean {
    if (this.state.phases[phase] !== "pending" && this.state.phases[phase] !== "active") return false;
    this.state.phases[phase] = "skipped";
    return true;
  }

  skipPhases(phases: WorkflowPhase[]): boolean {
    return phases.reduce((changed, phase) => this.skipPhase(phase) || changed, false);
  }

  completeCurrent(): boolean {
    const phase = this.state.currentPhase;
    if (!phase || this.state.phases[phase] === "complete") return false;
    this.state.phases[phase] = "complete";
    return true;
  }

  recordArtifact(phase: WorkflowPhase, path: string): boolean {
    if (this.state.artifacts[phase] === path) return false;
    this.state.artifacts[phase] = path;
    return true;
  }

  markPrompted(phase: WorkflowPhase): boolean {
    if (this.state.prompted[phase]) return false;
    this.state.prompted[phase] = true;
    return true;
  }

  onInputText(text: string): boolean {
    let changed = false;
    for (const line of text.split(/\r?\n/)) {
      const skill = parseSkillName(line);
      if (!skill) continue;
      const phase = SKILL_TO_PHASE[skill];
      if (phase) changed = this.advanceTo(phase) || changed;
    }
    return changed;
  }

  onSkillFileRead(path: string): boolean {
    const match = normalizePath(path).match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/);
    if (!match?.[1]) return false;
    const phase = SKILL_TO_PHASE[match[1]];
    return phase ? this.advanceTo(phase) : false;
  }

  onFileWritten(path: string): boolean {
    const normalized = normalizePath(path);
    if (CURRENT_DESIGN_RE.test(normalized) || PLUS_LEGACY_DESIGN_RE.test(normalized) || OBRA_DESIGN_RE.test(normalized)) {
      const advanced = this.advanceTo("brainstorm");
      return this.recordArtifact("brainstorm", normalized) || advanced;
    }
    if ((CURRENT_PLAN_RE.test(normalized) && !normalized.endsWith("-design.md")) || OBRA_PLAN_RE.test(normalized)) {
      const advanced = this.advanceTo("plan");
      return this.recordArtifact("plan", normalized) || advanced;
    }
    return false;
  }

  onTodoToolCall(input: Record<string, unknown>): boolean {
    if (input.action === "create") return this.advanceTo("execute");
    if (input.action === "update" && input.status === "in_progress") return this.advanceTo("execute");
    return false;
  }

  onTodoToolResult(details: unknown): boolean {
    if (!details || typeof details !== "object" || !Array.isArray((details as { tasks?: unknown }).tasks)) return false;
    const tasks = (details as { tasks: Array<{ status?: unknown }> }).tasks.filter((task) => task.status !== "deleted");
    if (tasks.length === 0 || tasks.some((task) => task.status !== "completed")) return false;
    if (this.state.currentPhase !== "execute") this.advanceTo("execute");
    return this.completeCurrent();
  }

  onSubagentToolCall(input: Record<string, unknown>): boolean {
    const agent = typeof input.agent === "string" ? input.agent : undefined;
    if (!agent) return false;
    if (agent === "worker") return this.advanceTo("execute");
    if (agent === "superpowers-code-reviewer") return this.advanceTo("review");
    if (agent === "superpowers-spec-reviewer") return this.state.currentPhase === "execute" ? false : this.advanceTo("execute");
    return false;
  }
}
