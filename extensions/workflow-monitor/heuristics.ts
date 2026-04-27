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

export type PathClassification = "spec" | "legacy-spec" | "plan" | "test" | "source" | "doc" | "other";

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

export function classifyPath(filePath: string): PathClassification {
  const normalized = filePath.split(path.sep).join("/").replace(/^\.\//, "");
  if (/^docs\/specs\/.*-design\.md$/.test(normalized)) return "spec";
  if (/^docs\/plans\/.*-design\.md$/.test(normalized)) return "legacy-spec";
  if (/^docs\/plans\/[^/]+\.md$/.test(normalized)) return "plan";
  if (isTestFile(normalized)) return "test";
  if (isSourceFile(normalized)) return "source";
  if (/\.(?:md|mdx|txt|rst)$/.test(normalized)) return "doc";
  return "other";
}

export function findCorrespondingTestFile(filePath: string): string {
  const normalized = filePath.split(path.sep).join("/").replace(/^\.\//, "");
  const parsed = path.posix.parse(normalized);
  const dir = parsed.dir === "src" || parsed.dir.startsWith("src/")
    ? parsed.dir.replace(/^src\/?/, "tests/")
    : parsed.dir === "lib" || parsed.dir.startsWith("lib/")
      ? parsed.dir.replace(/^lib\/?/, "test/")
      : `tests/${parsed.dir}`.replace(/\/$/, "");
  return path.posix.join(dir, `${parsed.name}.test${parsed.ext}`);
}
