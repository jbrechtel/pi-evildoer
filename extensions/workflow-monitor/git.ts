import { execFileSync } from "node:child_process";

function git(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function getCurrentGitRef(cwd = process.cwd()): string | null {
  const branch = git(["branch", "--show-current"], cwd);
  if (branch) return branch;
  return git(["rev-parse", "--short", "HEAD"], cwd);
}
