import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".kts",
]);

function normalize(filePath: string, cwd = process.cwd()): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  return path.relative(cwd, absolute).split(path.sep).join("/");
}

export function isAllowedThinkingPhaseWrite(filePath: string, cwd = process.cwd()): boolean {
  const relative = normalize(filePath, cwd);
  return relative.startsWith("docs/specs/") || relative.startsWith("docs/plans/");
}

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join("/");
  const base = path.posix.basename(normalized);

  return (
    normalized.startsWith("tests/") ||
    normalized.includes("/tests/") ||
    normalized.startsWith("test/") ||
    normalized.includes("/test/") ||
    normalized.includes("/__tests__/") ||
    base.includes(".test.") ||
    base.includes(".spec.")
  );
}

export function isSourceFile(filePath: string): boolean {
  if (isTestFile(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}
