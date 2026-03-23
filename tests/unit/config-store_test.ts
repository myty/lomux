import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
} from "../../src/config/store.ts";
import type { CocoConfig } from "../../src/config/store.ts";

// Use a temp directory for all tests to avoid touching ~/.coco
async function withTempHome<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const tmp = await Deno.makeTempDir({ prefix: "coco_test_" });
  const origHome = Deno.env.get("HOME");
  Deno.env.set("HOME", tmp);
  try {
    return await fn(tmp);
  } finally {
    if (origHome !== undefined) {
      Deno.env.set("HOME", origHome);
    } else {
      Deno.env.delete("HOME");
    }
    await Deno.remove(tmp, { recursive: true });
  }
}

Deno.test("loadConfig — returns DEFAULT_CONFIG on first run", async () => {
  await withTempHome(async () => {
    const config = await loadConfig();
    assertEquals(config.port, DEFAULT_CONFIG.port);
    assertEquals(config.logLevel, DEFAULT_CONFIG.logLevel);
    assertEquals(config.agents, []);
    assertEquals(config.modelMap, {});
    assertEquals(config.modelMappingPolicy, "compatible");
    assertEquals(config.lastStarted, null);
  });
});

Deno.test("loadConfig — creates ~/.ardo dir if absent", async () => {
  await withTempHome(async (home) => {
    await loadConfig();
    const stat = await Deno.stat(join(home, ".ardo"));
    assertEquals(stat.isDirectory, true);
  });
});

Deno.test("loadConfig — migrates legacy ~/.coco/config.json to ~/.ardo", async () => {
  await withTempHome(async (home) => {
    const legacyDir = join(home, ".coco");
    const canonicalDir = join(home, ".ardo");
    await Deno.mkdir(legacyDir, { recursive: true });

    const legacyConfig: CocoConfig = {
      ...DEFAULT_CONFIG,
      port: 12000,
      logLevel: "debug",
    };

    await Deno.writeTextFile(
      join(legacyDir, "config.json"),
      JSON.stringify(legacyConfig, null, 2) + "\n",
    );

    const loaded = await loadConfig();
    assertEquals(loaded.port, 12000);
    assertEquals(loaded.logLevel, "debug");

    const migratedRaw = await Deno.readTextFile(
      join(canonicalDir, "config.json"),
    );
    const migrated = JSON.parse(migratedRaw) as CocoConfig;
    assertEquals(migrated.port, 12000);
    assertEquals(migrated.logLevel, "debug");
  });
});

Deno.test("loadConfig — migration remains idempotent across repeated loads", async () => {
  await withTempHome(async (home) => {
    const legacyDir = join(home, ".coco");
    const canonicalDir = join(home, ".ardo");
    await Deno.mkdir(legacyDir, { recursive: true });

    await Deno.writeTextFile(
      join(legacyDir, "config.json"),
      JSON.stringify({ ...DEFAULT_CONFIG, port: 14000 }, null, 2) + "\n",
    );

    const first = await loadConfig();
    const second = await loadConfig();

    assertEquals(first.port, 14000);
    assertEquals(second.port, 14000);

    const canonicalRaw = await Deno.readTextFile(
      join(canonicalDir, "config.json"),
    );
    const canonical = JSON.parse(canonicalRaw) as CocoConfig;
    assertEquals(canonical.port, 14000);
  });
});

Deno.test("saveConfig + loadConfig — round-trip", async () => {
  await withTempHome(async () => {
    const config: CocoConfig = {
      port: 12345,
      logLevel: "debug",
      modelMap: { "claude-3": "claude-3-sonnet" },
      agents: [],
      modelMappingPolicy: "strict",
      lastStarted: "2026-01-01T00:00:00.000Z",
      streaming: {
        flushTimeoutMs: 100,
        maxBufferBytes: 2048,
        enableAggressiveFlushing: false,
        enableDiagnostics: true,
        highWaterMark: 32768,
      },
    };
    await saveConfig(config);
    const loaded = await loadConfig();
    assertEquals(loaded.port, 12345);
    assertEquals(loaded.logLevel, "debug");
    assertEquals(loaded.modelMap, { "claude-3": "claude-3-sonnet" });
    assertEquals(loaded.modelMappingPolicy, "strict");
    assertEquals(loaded.lastStarted, "2026-01-01T00:00:00.000Z");
    assertEquals(loaded.streaming.flushTimeoutMs, 100);
    assertEquals(loaded.streaming.enableDiagnostics, true);
  });
});

Deno.test("saveConfig — rejects invalid modelMappingPolicy", async () => {
  await withTempHome(async () => {
    await assertRejects(
      () =>
        saveConfig({
          ...DEFAULT_CONFIG,
          modelMappingPolicy:
            "auto" as unknown as CocoConfig["modelMappingPolicy"],
        }),
      Error,
      "Invalid modelMappingPolicy",
    );
  });
});

Deno.test("saveConfig — rejects invalid port (low)", async () => {
  await withTempHome(async () => {
    await assertRejects(
      () => saveConfig({ ...DEFAULT_CONFIG, port: 80 }),
      Error,
      "Invalid port",
    );
  });
});

Deno.test("saveConfig — rejects invalid port (high)", async () => {
  await withTempHome(async () => {
    await assertRejects(
      () => saveConfig({ ...DEFAULT_CONFIG, port: 99999 }),
      Error,
      "Invalid port",
    );
  });
});

Deno.test("saveConfig — rejects invalid logLevel", async () => {
  await withTempHome(async () => {
    await assertRejects(
      () =>
        saveConfig({
          ...DEFAULT_CONFIG,
          logLevel: "verbose" as unknown as CocoConfig["logLevel"],
        }),
      Error,
      "Invalid logLevel",
    );
  });
});

Deno.test("loadConfig — throws on malformed JSON", async () => {
  await withTempHome(async (home) => {
    const dir = join(home, ".ardo");
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(join(dir, "config.json"), "{ bad json }");
    await assertRejects(
      () => loadConfig(),
      Error,
      "Failed to parse",
    );
  });
});

Deno.test("loadConfig — ARDO_PORT overrides file/default", async () => {
  await withTempHome(async () => {
    Deno.env.set("ARDO_PORT", "13000");
    try {
      const loaded = await loadConfig();
      assertEquals(loaded.port, 13000);
    } finally {
      Deno.env.delete("ARDO_PORT");
    }
  });
});

Deno.test("loadConfig — COCO_PORT is honored as legacy fallback", async () => {
  await withTempHome(async () => {
    Deno.env.set("COCO_PORT", "13001");
    try {
      const loaded = await loadConfig();
      assertEquals(loaded.port, 13001);
    } finally {
      Deno.env.delete("COCO_PORT");
    }
  });
});

Deno.test("loadConfig — ARDO_PORT takes precedence over COCO_PORT", async () => {
  await withTempHome(async () => {
    Deno.env.set("ARDO_PORT", "13002");
    Deno.env.set("COCO_PORT", "13003");
    try {
      const loaded = await loadConfig();
      assertEquals(loaded.port, 13002);
    } finally {
      Deno.env.delete("ARDO_PORT");
      Deno.env.delete("COCO_PORT");
    }
  });
});
