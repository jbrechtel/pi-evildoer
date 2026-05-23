import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export const BOOTSTRAP_MARKER = "<!-- pi-superpowers-bootstrap -->";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? content.slice(match[0].length) : content;
}

export function buildCompanionNotice(activeToolNames: readonly string[]): string {
  const active = new Set(activeToolNames);
  const missing: string[] = [];

  if (!active.has("todo")) {
    missing.push("- @juicesharp/rpiv-todo is missing, so the todo tool is unavailable.");
  }

  if (missing.length === 0) return "";

  return [
    "## Pi Superpowers companion package warning",
    "",
    "The pi-superpowers package expects these companion tools at runtime:",
    ...missing,
    "",
    "Install them with:",
    "```bash",
    "pi install npm:@juicesharp/rpiv-todo",
    "```",
  ].join("\n");
}

export function buildBootstrapPrompt(usingSuperpowersContent: string): string {
  const body = stripFrontmatter(usingSuperpowersContent).trim();

  return [
    BOOTSTRAP_MARKER,
    "# You have superpowers",
    "",
    "The using-superpowers skill content is included below and is mandatory behavior for this session.",
    "",
    "## Pi tool mappings",
    "",
    "- TodoWrite → todo from @juicesharp/rpiv-todo.",
    "- Read / Write / Edit / Bash → Pi read / write / edit / bash.",
    "",
    "@juicesharp/rpiv-todo is an installed companion package for pi-evildoer.",
    "",
    "## Included using-superpowers skill",
    "",
    body,
  ].join("\n");
}

export function shouldInjectBootstrap(systemPrompt = ""): boolean {
  return !systemPrompt.includes(BOOTSTRAP_MARKER);
}

function readUsingSuperpowersSkill(): string {
  return readFileSync(join(__dirname, "..", "skills", "using-superpowers", "SKILL.md"), "utf8");
}

function normalizeToolNames(tools: readonly unknown[]): string[] {
  return tools
    .map((tool) => {
      if (typeof tool === "string") return tool;
      if (tool && typeof tool === "object" && "name" in tool) {
        const name = (tool as { name?: unknown }).name;
        return typeof name === "string" ? name : undefined;
      }
      return undefined;
    })
    .filter((name): name is string => Boolean(name));
}

export default function (pi: ExtensionAPI) {
  if (Number(process.env.PI_SUBAGENT_DEPTH ?? "0") > 0) return;

  const usingSuperpowersContent = readUsingSuperpowersSkill();

  pi.on("before_agent_start", async (event) => {
    if (!shouldInjectBootstrap(event.systemPrompt)) return;

    const activeToolNames = normalizeToolNames(pi.getActiveTools() as readonly unknown[]);
    const companionNotice = buildCompanionNotice(activeToolNames);
    const bootstrap = buildBootstrapPrompt(usingSuperpowersContent);
    const additions = companionNotice ? `${bootstrap}\n\n${companionNotice}` : bootstrap;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${additions}`,
    };
  });
}
