import type { WorkflowViolation } from "./workflow-handler.ts";

export function processWriteWarning(path?: string): string {
  return [
    "Superpowers workflow guardrail: Brainstorm/Plan phases may only write canonical artifacts.",
    "Allowed paths: docs/superpowers/specs/ and docs/superpowers/plans/.",
    path ? `Attempted path: ${path}` : undefined,
  ].filter(Boolean).join("\n");
}

export function tddWarning(): string {
  return "Superpowers TDD guardrail: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.";
}

export function verificationWarning(violation: WorkflowViolation): string {
  return [
    "Superpowers verification guardrail: completion command blocked/warned because verification is stale.",
    `Triggered by: ${violation.command ?? violation.type}`,
    "Missing: a fresh passing test/verification command after source edits.",
  ].join("\n");
}

export function warningForViolation(violation: WorkflowViolation): string {
  if (violation.type === "process-write-during-thinking") return processWriteWarning(violation.path);
  return verificationWarning(violation);
}
