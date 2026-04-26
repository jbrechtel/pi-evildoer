#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const PROJECT = "/tmp/e2e-project";
const SESSION_DIR = "/tmp/e2e-sessions";
const PACKAGE_SOURCE = "/workspace/pi-superpowers";
const MODEL = "zai/glm-5-turbo";
const SECRET_ENV_NAME = "ZAI_API_KEY";

type RunOptions = {
  cwd?: string;
  timeout?: number;
  allowFailure?: boolean;
  tools?: string;
  env?: NodeJS.ProcessEnv;
};

function fail(message: string, details = "") {
  console.error(`\n[E2E FAIL] ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function run(name: string, command: string, args: string[], options: RunOptions = {}) {
  console.error(`\n[E2E] ${name}`);
  console.error([command, ...args].join(" "));
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT,
    env: { ...process.env, ...options.env, PATH: process.env.PATH || "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/tmp/pi-home", PI_CODING_AGENT_DIR: "/tmp/pi-home/.pi/agent" },
    encoding: "utf8",
    timeout: options.timeout ?? 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${name} exited ${result.status}`, `signal=${result.signal ?? "none"}\nerror=${result.error?.message ?? "none"}\n${combined}`);
  }
  return { ...result, combined };
}

function assertIncludes(text: string, expected: string, phase: string) {
  if (!text.includes(expected)) {
    fail(`${phase}: missing expected text`, `Expected: ${expected}\n\nOutput:\n${text}`);
  }
}

function assertNotIncludes(text: string, unexpected: string, phase: string) {
  if (text.includes(unexpected)) {
    fail(`${phase}: found unexpected text`, `Unexpected: ${unexpected}\n\nOutput:\n${text}`);
  }
}

function piPrompt(name: string, prompt: string, options: RunOptions = {}) {
  const args: string[] = ["--model", MODEL, "--session-dir", SESSION_DIR];
  if (options.tools) args.push("--tools", options.tools);
  args.push("-p", prompt);
  return run(name, "pi", args, options).combined;
}

mkdirSync(`${PROJECT}/src`, { recursive: true });
mkdirSync(`${PROJECT}/tests`, { recursive: true });
mkdirSync(SESSION_DIR, { recursive: true });

writeFileSync(`${PROJECT}/package.json`, JSON.stringify({ type: "module", scripts: { test: "node --experimental-strip-types --test tests/*.test.ts" } }, null, 2));
writeFileSync(`${PROJECT}/mise.toml`, '[tasks.test]\nrun = "npm test"\n');
writeFileSync(`${PROJECT}/src/math.ts`, "export function add(a: number, b: number): number { return a + b; }\n");
writeFileSync(
  `${PROJECT}/tests/math.test.ts`,
  'import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport { add } from "../src/math.ts";\n\ntest("adds", () => assert.equal(add(2, 3), 5));\n',
);

run("install pi-superpowers", "pi", ["install", "-l", PACKAGE_SOURCE]);
run("install zai provider", "pi", ["install", "-l", "npm:@thesethrose/pi-zai-provider"]);

const warningPrompt = "Report the pi-superpowers companion package warning from your system prompt verbatim. Include install commands exactly if present.";

const phase1 = piPrompt("phase 1 missing companions", warningPrompt);
assertIncludes(phase1, "pi install npm:@juicesharp/rpiv-todo", "phase 1");
assertIncludes(phase1, "pi install npm:pi-subagents", "phase 1");
assertIncludes(phase1, "todo", "phase 1");
assertIncludes(phase1, "subagent", "phase 1");

run("install todo companion", "pi", ["install", "-l", "npm:@juicesharp/rpiv-todo"]);
const phase2 = piPrompt("phase 2 missing subagents only", warningPrompt);
assertIncludes(phase2, "pi install npm:pi-subagents", "phase 2");
assertNotIncludes(phase2, "@juicesharp/rpiv-todo is missing", "phase 2");

run("install subagents companion", "pi", ["install", "-l", "npm:pi-subagents"]);
const phase3 = piPrompt("phase 3 companions installed", warningPrompt);
assertNotIncludes(phase3, "pi install npm:@juicesharp/rpiv-todo", "phase 3");
assertNotIncludes(phase3, "pi install npm:pi-subagents", "phase 3");

const missingReviewer = piPrompt(
  "phase 4 missing reviewer",
  "Call the subagent tool exactly once with agent superpowers-spec-reviewer and task: Review src/math.ts against requirement add(a,b) returns a+b. Do not call any other tools. If the tool reports the agent is missing, summarize that failure.",
  { allowFailure: true, tools: "subagent" },
);
assertIncludes(missingReviewer, "superpowers-spec-reviewer", "phase 4 missing reviewer");

run("copy reviewer agents", "bash", ["-lc", [
  "mkdir -p .pi/agents",
  "cp /workspace/pi-superpowers/agents/superpowers-spec-reviewer.md .pi/agents/",
  "cp /workspace/pi-superpowers/agents/superpowers-code-reviewer.md .pi/agents/",
].join(" && ")]);

const review = piPrompt(
  "phase 4 reviewer works",
  "Use the subagent tool with agent superpowers-spec-reviewer to review src/math.ts against requirement: add(a,b) returns a+b. Return the reviewer result.",
  { timeout: 300_000 },
);
assertIncludes(review.toLowerCase(), "spec", "phase 4 reviewer works");

const workflow = piPrompt(
  "phase 5 workflow proof",
  "Create a todo for this E2E proof, run the project verification command, then report whether verification passed. Do not modify files.",
  { timeout: 300_000 },
);
assertIncludes(workflow.toLowerCase(), "verification", "phase 5 workflow proof");
assertIncludes(workflow.toLowerCase(), "pass", "phase 5 workflow proof");

console.log("Docker E2E installation recovery passed");
