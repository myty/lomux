/**
 * Per-agent configuration writers.
 *
 * Writes the endpoint configuration for each supported agent so it routes
 * API traffic through Coco's local proxy. Backs up original files and
 * supports reversible unconfigure.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import { parse as parseToml, stringify as stringifyToml } from "@std/toml";
import { join } from "@std/path";
import {
  type CocoConfig,
  type ConfigEntry,
  saveConfig,
} from "../config/store.ts";
import { getAgent } from "./registry.ts";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ConfigureOptions {
  /** Override home directory (primarily for testing). */
  homeDir?: string;
  /** Override current working directory for project-relative configs (Kilo). */
  cwd?: string;
  /** Skip the post-write validation test call. */
  skipValidation?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveHome(options?: ConfigureOptions): string {
  return (
    options?.homeDir ??
      Deno.env.get("HOME") ??
      Deno.env.get("USERPROFILE") ??
      "."
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Backup a file to `<path>.coco-backup`. Returns the backup path. */
async function backupFile(path: string): Promise<string> {
  const backupPath = `${path}.coco-backup`;
  await Deno.copyFile(path, backupPath);
  return backupPath;
}

/** Ensure all parent directories of `path` exist. */
async function ensureDir(path: string): Promise<void> {
  const parts = path.split("/");
  parts.pop(); // remove filename
  if (parts.length > 0) {
    await Deno.mkdir(parts.join("/"), { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Per-agent config path resolvers
// ---------------------------------------------------------------------------

function claudeCodeConfigPath(homeDir: string): string {
  return join(homeDir, ".claude", "settings.json");
}

function clineConfigPath(homeDir: string): string {
  return join(homeDir, ".cline", "endpoints.json");
}

function kiloConfigPath(cwd: string): string {
  return join(cwd, ".kilocode", "config.json");
}

function openCodeEnvPath(homeDir: string): string {
  return join(homeDir, ".coco", "env", "opencode.env");
}

function gooseConfigPath(homeDir: string): string {
  return join(homeDir, ".goose", "config.toml");
}

function aiderConfigPath(homeDir: string): string {
  return join(homeDir, ".aider.conf.yml");
}

function gptEngineerEnvPath(homeDir: string): string {
  return join(homeDir, ".coco", "env", "gpt-engineer.env");
}

// ---------------------------------------------------------------------------
// Per-agent write logic (T032)
// ---------------------------------------------------------------------------

interface WriteResult {
  configPath: string;
  backupPath: string | null;
}

async function writeClaudeCode(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = claudeCodeConfigPath(resolveHome(options));
  let backupPath: string | null = null;

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
    const raw = await Deno.readTextFile(configPath);
    existing = JSON.parse(raw) as Record<string, unknown>;
  }

  const existingEnv = (existing.env as Record<string, unknown>) ?? {};
  const updated = {
    ...existing,
    env: {
      ...existingEnv,
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
      ANTHROPIC_AUTH_TOKEN: "coco",
    },
  };

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, JSON.stringify(updated, null, 2) + "\n");
  return { configPath, backupPath };
}

async function writeCline(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = clineConfigPath(resolveHome(options));
  let backupPath: string | null = null;

  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
  }

  const content = {
    apiBaseUrl: `http://127.0.0.1:${port}`,
    appBaseUrl: `http://127.0.0.1:${port}`,
    mcpBaseUrl: `http://127.0.0.1:${port}`,
  };

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, JSON.stringify(content, null, 2) + "\n");
  return { configPath, backupPath };
}

async function writeKilo(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const cwd = options?.cwd ?? Deno.cwd();
  const configPath = kiloConfigPath(cwd);
  let backupPath: string | null = null;

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
    const raw = await Deno.readTextFile(configPath);
    existing = JSON.parse(raw) as Record<string, unknown>;
  }

  const updated = {
    ...existing,
    apiBaseUrl: `http://127.0.0.1:${port}`,
    apiKey: "coco",
  };

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, JSON.stringify(updated, null, 2) + "\n");
  return { configPath, backupPath };
}

async function writeOpenCode(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = openCodeEnvPath(resolveHome(options));
  let backupPath: string | null = null;

  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
  }

  const content = [
    "# Written by coco configure opencode",
    `OPENAI_API_BASE=http://127.0.0.1:${port}`,
    "OPENAI_API_KEY=coco",
    "",
  ].join("\n");

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, content);
  return { configPath, backupPath };
}

async function writeGoose(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = gooseConfigPath(resolveHome(options));
  let backupPath: string | null = null;

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
    const raw = await Deno.readTextFile(configPath);
    existing = parseToml(raw) as Record<string, unknown>;
  }

  const existingOpenai = (existing.openai as Record<string, unknown>) ?? {};
  const updated = {
    ...existing,
    openai: {
      ...existingOpenai,
      base_url: `http://127.0.0.1:${port}`,
      api_key: "coco",
    },
  };

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, stringifyToml(updated));
  return { configPath, backupPath };
}

async function writeAider(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = aiderConfigPath(resolveHome(options));
  let backupPath: string | null = null;

  let existing: Record<string, unknown> = {};
  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
    const raw = await Deno.readTextFile(configPath);
    const parsed = parseYaml(raw);
    if (parsed && typeof parsed === "object") {
      existing = parsed as Record<string, unknown>;
    }
  }

  const updated = {
    ...existing,
    "openai-api-base": `http://127.0.0.1:${port}`,
    "openai-api-key": "coco",
  };

  await ensureDir(configPath);
  await Deno.writeTextFile(
    configPath,
    "# Written by coco configure aider\n" + stringifyYaml(updated),
  );
  return { configPath, backupPath };
}

async function writeGptEngineer(
  port: number,
  options?: ConfigureOptions,
): Promise<WriteResult> {
  const configPath = gptEngineerEnvPath(resolveHome(options));
  let backupPath: string | null = null;

  if (await fileExists(configPath)) {
    backupPath = await backupFile(configPath);
  }

  const content = [
    "# Written by coco configure gpt-engineer",
    `OPENAI_API_BASE=http://127.0.0.1:${port}`,
    "OPENAI_API_KEY=coco",
    "",
  ].join("\n");

  await ensureDir(configPath);
  await Deno.writeTextFile(configPath, content);
  return { configPath, backupPath };
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

type AgentWriter = (
  port: number,
  options?: ConfigureOptions,
) => Promise<WriteResult>;

const AGENT_WRITERS: Record<string, AgentWriter> = {
  "claude-code": writeClaudeCode,
  "cline": writeCline,
  "kilo": writeKilo,
  "opencode": writeOpenCode,
  "goose": writeGoose,
  "aider": writeAider,
  "gpt-engineer": writeGptEngineer,
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Perform a 1-token probe against the running Coco proxy to verify
 * that an agent's config would work. Returns true if the probe succeeds.
 */
export async function validateConfig(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer coco",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });
    await res.body?.cancel();
    return res.status === 200;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API (T031)
// ---------------------------------------------------------------------------

/**
 * Configure an agent to route through Coco's proxy.
 * Backs up any existing config, writes the agent-specific format, runs a
 * validation probe, and persists the ConfigEntry to CocoConfig.
 */
export async function configureAgent(
  agentName: string,
  port: number,
  cocoConfig: CocoConfig,
  options?: ConfigureOptions,
): Promise<ConfigEntry> {
  const agent = getAgent(agentName);
  if (!agent) {
    throw new Error(`Unknown agent: "${agentName}"`);
  }

  const writer = AGENT_WRITERS[agentName];
  if (!writer) {
    throw new Error(`No config writer for agent: "${agentName}"`);
  }

  const { configPath, backupPath } = await writer(port, options);

  const skipValidation = options?.skipValidation ?? false;
  let validatedAt: string | null = null;
  if (!skipValidation) {
    const valid = await validateConfig(port);
    validatedAt = valid ? new Date().toISOString() : null;
  }

  const entry: ConfigEntry = {
    agentName,
    configPath,
    backupPath,
    endpoint: `http://127.0.0.1:${port}`,
    appliedAt: new Date().toISOString(),
    validatedAt,
  };

  // Replace any existing entry for this agent
  const agents = cocoConfig.agents.filter((a) => a.agentName !== agentName);
  agents.push(entry);
  await saveConfig({ ...cocoConfig, agents });

  return entry;
}

/**
 * Revert an agent's configuration to its pre-Coco state.
 * Restores backup if one exists, or deletes the written file.
 * Removes the ConfigEntry from CocoConfig.
 */
export async function unconfigureAgent(
  agentName: string,
  cocoConfig: CocoConfig,
): Promise<void> {
  const entry = cocoConfig.agents.find((a) => a.agentName === agentName);
  if (!entry) {
    return; // not configured — nothing to undo
  }

  if (entry.backupPath !== null) {
    // Restore backup
    await Deno.rename(entry.backupPath, entry.configPath);
  } else {
    // No prior file — delete the one Coco created
    try {
      await Deno.remove(entry.configPath);
    } catch {
      // already gone — fine
    }
  }

  const agents = cocoConfig.agents.filter((a) => a.agentName !== agentName);
  await saveConfig({ ...cocoConfig, agents });
}

/**
 * Check whether an agent is currently configured in CocoConfig.
 */
export function isAgentConfigured(
  agentName: string,
  cocoConfig: CocoConfig,
): boolean {
  return cocoConfig.agents.some((a) => a.agentName === agentName);
}
