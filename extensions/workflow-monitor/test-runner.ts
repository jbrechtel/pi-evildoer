const TEST_COMMAND_PATTERNS = [
  /(^|\s)node\s+.*--test(\s|$)/,
  /(^|\s)npm\s+test(\s|$)/,
  /(^|\s)npm\s+run\s+test(\s|$)/,
  /(^|\s)pnpm\s+test(\s|$)/,
  /(^|\s)yarn\s+test(\s|$)/,
  /(^|\s)(npx\s+)?vitest(\s|$)/,
  /(^|\s)(npx\s+)?jest(\s|$)/,
  /(^|\s)pytest(\s|$)/,
  /(^|\s)cargo\s+test(\s|$)/,
  /(^|\s)cargo\s+nextest(?:\s+run)?(\s|$)/,
  /(^|\s)go\s+test(\s|$)/,
  /(^|\s)rspec(\s|$)/,
  /(^|\s)phpunit(\s|$)/,
  /(^|\s)dotnet\s+test(\s|$)/,
  /(^|\s)(npx\s+)?mocha(\s|$)/,
];

const VERIFICATION_COMMAND_PATTERNS = [
  /(^|\s)npm\s+run\s+lint(\s|$)/,
  /(^|\s)npm\s+run\s+build(\s|$)/,
  /(^|\s)pnpm\s+lint(\s|$)/,
  /(^|\s)pnpm\s+build(\s|$)/,
  /(^|\s)yarn\s+lint(\s|$)/,
  /(^|\s)yarn\s+build(\s|$)/,
  /(^|\s)cargo\s+clippy(\s|$)/,
  /(^|\s)cargo\s+build(\s|$)/,
  /(^|\s)go\s+vet(\s|$)/,
];

function normalizeMiseCommand(command: string): string[] {
  const trimmed = command.trim();
  const commands = [trimmed];

  if (/^mise\s+(run\s+)?test(\s|$)/.test(trimmed)) {
    commands.push("npm test");
  }

  const execMatch = trimmed.match(/^mise\s+exec\b[\s\S]*?\s--\s+([\s\S]+)$/);
  if (execMatch?.[1]) {
    commands.push(execMatch[1].trim());
  }

  return commands;
}

export type TestCommandKind = "test" | "verification" | null;

export function parseTestCommand(command: string): boolean {
  return normalizeMiseCommand(command).some((candidate) =>
    TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(candidate)),
  );
}

export function testCommandKind(command: string): TestCommandKind {
  const candidates = normalizeMiseCommand(command);
  if (candidates.some((candidate) => TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(candidate)))) return "test";
  if (candidates.some((candidate) => VERIFICATION_COMMAND_PATTERNS.some((pattern) => pattern.test(candidate)))) return "verification";
  return null;
}

export function parseTestResult(output: string, exitCode?: number | null): boolean | null {
  if (typeof exitCode === "number") return exitCode === 0;
  if (/\b(?:passing|passed|success|successful)\b/i.test(output) && !/\b(?:fail|failed|failure)\b/i.test(output)) return true;
  if (/\b(?:fail|failed|failure|error)\b/i.test(output)) return false;
  return null;
}
