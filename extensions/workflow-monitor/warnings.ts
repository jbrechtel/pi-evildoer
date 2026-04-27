import type { WorkflowViolation } from "./workflow-handler.ts";

export function processWriteWarning(path?: string): string {
  return [
    "Superpowers workflow guardrail: Brainstorm/Plan phases may only write canonical artifacts.",
    "Allowed paths: docs/specs/ and docs/plans/.",
    path ? `Attempted path: ${path}` : undefined,
  ].filter(Boolean).join("\n");
}

export function tddWarning(detail?: string): string {
  return [
    "Superpowers TDD guardrail: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.",
    detail,
  ].filter(Boolean).join("\n");
}

export function debugWarning(detail?: string): string {
  return [
    "Superpowers debugging guardrail: investigate root cause before fixes.",
    detail,
  ].filter(Boolean).join("\n");
}

export const getTddViolationWarning = tddWarning;
export const getDebugViolationWarning = debugWarning;

export function verificationWarning(violation: WorkflowViolation): string {
  return [
    "Superpowers verification guardrail: completion command blocked/warned because verification is stale.",
    `Triggered by: ${violation.command ?? violation.type}`,
    "Missing: a fresh passing test/verification command after source edits.",
  ].join("\n");
}

export const getVerificationViolationWarning = verificationWarning;

export function warningForViolation(violation: WorkflowViolation): string {
  if (violation.type === "process-write-during-thinking") return processWriteWarning(violation.path);
  if (violation.type === "source-before-failing-test") return tddWarning(violation.message);
  if (violation.type === "fix-before-investigation" || violation.type === "repeated-fix-failures") {
    return debugWarning(violation.message);
  }
  return verificationWarning(violation);
}
