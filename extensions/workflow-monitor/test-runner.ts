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

export function parseTestCommand(command: string): boolean {
  return TEST_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

export function parseTestResult(_output: string, exitCode?: number | null): boolean | null {
  if (typeof exitCode === "number") return exitCode === 0;
  return null;
}
