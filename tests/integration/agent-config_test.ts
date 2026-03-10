/**
 * Integration tests for per-agent configuration (src/agents/config.ts).
 *
 * These tests use temp directories to avoid touching real config files.
 * The validateConfig() probe tests require a running daemon and are marked
 * ignore: true — enable them with `coco start` before running manually.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  configureAgent,
  isAgentConfigured,
  unconfigureAgent,
  validateConfig,
} from "../../src/agents/config.ts";
import { type CocoConfig, DEFAULT_CONFIG } from "../../src/config/store.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTempHome(
  fn: (homeDir: string, configDir: string) => Promise<void>,
): Promise<void> {
  const homeDir = await Deno.makeTempDir();
  const configDir = `${homeDir}/.coco`;
  await Deno.mkdir(configDir, { recursive: true });
  try {
    await fn(homeDir, configDir);
  } finally {
    await Deno.remove(homeDir, { recursive: true });
  }
}

/** Create a CocoConfig backed by a temp dir (avoids touching ~/.coco). */
function makeTempConfig(_configDir: string): CocoConfig {
  // We patch saveConfig via the homeDir option — config writes go to configDir
  return { ...DEFAULT_CONFIG };
}

// ---------------------------------------------------------------------------
// Aider — YAML merge, backup/restore
// ---------------------------------------------------------------------------

Deno.test("configureAgent(aider) — creates config file when none exists", async () => {
  await withTempHome(async (homeDir) => {
    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    assertEquals(entry.agentName, "aider");
    assertEquals(entry.backupPath, null); // no prior file
    assertEquals(entry.endpoint, "http://127.0.0.1:11434");

    const content = await Deno.readTextFile(entry.configPath);
    assertStringIncludes(content, "openai-api-base:");
    assertStringIncludes(content, "http://127.0.0.1:11434");
    assertStringIncludes(content, "openai-api-key: coco");
  });
});

Deno.test("configureAgent(aider) — backs up existing file before overwriting", async () => {
  await withTempHome(async (homeDir) => {
    // Write an existing config
    const existingPath = `${homeDir}/.aider.conf.yml`;
    await Deno.writeTextFile(existingPath, "some-other-key: true\n");

    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    // Backup must exist and contain original content
    assertEquals(entry.backupPath, `${existingPath}.coco-backup`);
    const backup = await Deno.readTextFile(entry.backupPath!);
    assertStringIncludes(backup, "some-other-key: true");

    // New file must contain coco keys
    const content = await Deno.readTextFile(entry.configPath);
    assertStringIncludes(content, "openai-api-base:");
  });
});

Deno.test("configureAgent(aider) — preserves existing YAML keys on merge", async () => {
  await withTempHome(async (homeDir) => {
    const existingPath = `${homeDir}/.aider.conf.yml`;
    await Deno.writeTextFile(
      existingPath,
      "model: gpt-4\nauto-commits: false\n",
    );

    const config = makeTempConfig(homeDir);
    await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    const content = await Deno.readTextFile(existingPath);
    assertStringIncludes(content, "model:");
    assertStringIncludes(content, "auto-commits:");
    assertStringIncludes(content, "openai-api-base:");
  });
});

Deno.test("unconfigureAgent(aider) — removes file when backupPath is null", async () => {
  await withTempHome(async (homeDir) => {
    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });
    assertEquals(entry.backupPath, null);

    // Reload config with the new entry
    const updatedConfig: CocoConfig = { ...config, agents: [entry] };
    await unconfigureAgent("aider", updatedConfig);

    let fileGone = false;
    try {
      await Deno.stat(entry.configPath);
    } catch {
      fileGone = true;
    }
    assertEquals(fileGone, true);
  });
});

Deno.test("unconfigureAgent(aider) — restores backup when one exists", async () => {
  await withTempHome(async (homeDir) => {
    const existingPath = `${homeDir}/.aider.conf.yml`;
    const originalContent = "model: gpt-4\n";
    await Deno.writeTextFile(existingPath, originalContent);

    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });
    const updatedConfig: CocoConfig = { ...config, agents: [entry] };

    await unconfigureAgent("aider", updatedConfig);

    const restored = await Deno.readTextFile(existingPath);
    assertEquals(restored, originalContent);

    // Backup file should be gone after restore
    let backupGone = false;
    try {
      await Deno.stat(entry.backupPath!);
    } catch {
      backupGone = true;
    }
    assertEquals(backupGone, true);
  });
});

// ---------------------------------------------------------------------------
// Claude Code — JSON merge
// ---------------------------------------------------------------------------

Deno.test("configureAgent(claude-code) — merges only ANTHROPIC keys, preserves others", async () => {
  await withTempHome(async (homeDir) => {
    // Pre-existing settings with other fields
    const settingsPath = `${homeDir}/.claude/settings.json`;
    await Deno.mkdir(`${homeDir}/.claude`, { recursive: true });
    await Deno.writeTextFile(
      settingsPath,
      JSON.stringify({ theme: "dark", env: { OTHER_KEY: "preserve-me" } }),
    );

    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("claude-code", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    const content = JSON.parse(await Deno.readTextFile(entry.configPath));
    assertEquals(content.theme, "dark");
    assertEquals(content.env.OTHER_KEY, "preserve-me");
    assertEquals(content.env.ANTHROPIC_BASE_URL, "http://127.0.0.1:11434");
    assertEquals(content.env.ANTHROPIC_AUTH_TOKEN, "coco");
  });
});

// ---------------------------------------------------------------------------
// Cline — full JSON write
// ---------------------------------------------------------------------------

Deno.test("configureAgent(cline) — writes all three URL fields", async () => {
  await withTempHome(async (homeDir) => {
    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("cline", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    const content = JSON.parse(await Deno.readTextFile(entry.configPath));
    assertEquals(content.apiBaseUrl, "http://127.0.0.1:11434");
    assertEquals(content.appBaseUrl, "http://127.0.0.1:11434");
    assertEquals(content.mcpBaseUrl, "http://127.0.0.1:11434");
  });
});

// ---------------------------------------------------------------------------
// OpenCode / GPT-Engineer — env file
// ---------------------------------------------------------------------------

Deno.test("configureAgent(opencode) — writes env file with correct vars", async () => {
  await withTempHome(async (homeDir) => {
    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("opencode", 11434, config, {
      homeDir,
      skipValidation: true,
    });

    const content = await Deno.readTextFile(entry.configPath);
    assertStringIncludes(content, "OPENAI_API_BASE=http://127.0.0.1:11434");
    assertStringIncludes(content, "OPENAI_API_KEY=coco");
  });
});

// ---------------------------------------------------------------------------
// isAgentConfigured
// ---------------------------------------------------------------------------

Deno.test("isAgentConfigured returns false when agent not in config", () => {
  const config = { ...DEFAULT_CONFIG, agents: [] };
  assertEquals(isAgentConfigured("aider", config), false);
});

Deno.test("isAgentConfigured returns true after configureAgent is called", async () => {
  await withTempHome(async (homeDir) => {
    const config = makeTempConfig(homeDir);
    const entry = await configureAgent("aider", 11434, config, {
      homeDir,
      skipValidation: true,
    });
    const updatedConfig: CocoConfig = { ...config, agents: [entry] };
    assertEquals(isAgentConfigured("aider", updatedConfig), true);
  });
});

// ---------------------------------------------------------------------------
// Unknown agent
// ---------------------------------------------------------------------------

Deno.test("configureAgent throws on unknown agent name", async () => {
  const config = { ...DEFAULT_CONFIG };
  let threw = false;
  try {
    await configureAgent("no-such-agent", 11434, config, {
      skipValidation: true,
    });
  } catch (e) {
    threw = true;
    assertStringIncludes((e as Error).message, "Unknown agent");
  }
  assertEquals(threw, true);
});

// ---------------------------------------------------------------------------
// Validation probe (requires running daemon — manually enabled)
// ---------------------------------------------------------------------------

Deno.test({
  name: "validateConfig returns true against running daemon",
  ignore: true,
  fn: async () => {
    const valid = await validateConfig(11434);
    assertEquals(valid, true);
  },
});
