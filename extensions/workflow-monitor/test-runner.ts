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
  /(^|\s)go\s+test(\s|$)/,
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

export function parseTestCommand(command: string): boolean {
  return normalizeMiseCommand(command).some((candidate) =>
    TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(candidate)),
  );
}

export function parseTestResult(_output: string, exitCode?: number | null): boolean | null {
  if (typeof exitCode === "number") return exitCode === 0;
  return null;
}
