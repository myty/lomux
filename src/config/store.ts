import { join } from "@std/path";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type ModelMappingPolicy = "compatible" | "strict";

export interface ConfigEntry {
  agentName: string;
  configPath: string;
  backupPath: string | null;
  endpoint: string;
  appliedAt: string;
  validatedAt: string | null;
}

export interface StreamingConfig {
  /** Timeout in milliseconds to force flush incomplete lines. Default: 50ms. */
  flushTimeoutMs: number;
  /** Maximum buffer size in bytes before forcing a flush. Default: 1024 bytes. */
  maxBufferBytes: number;
  /** Enable aggressive flushing for better streaming experience. Default: true. */
  enableAggressiveFlushing: boolean;
  /** Enable streaming diagnostics collection. Default: false. */
  enableDiagnostics: boolean;
  /** ReadableStream high water mark. Default: 16384. */
  highWaterMark: number;
}

export interface CocoConfig {
  /** TCP port the proxy listens on. Default: 11434. */
  port: number;
  /** Log level for ~/.ardo/ardo.log. Default: "info". */
  logLevel: LogLevel;
  /**
   * User-defined model alias overrides.
   * Merged over DEFAULT_MODEL_MAP at runtime. User entries win.
   */
  modelMap: Record<string, string>;
  /** Per-agent configuration records. */
  agents: ConfigEntry[];
  /** Model resolution policy. "compatible" allows fallback remaps; "strict" requires exact model match. */
  modelMappingPolicy: ModelMappingPolicy;
  /** ISO timestamp of last successful daemon start. */
  lastStarted: string | null;
  /** Streaming configuration for response delivery. */
  streaming: StreamingConfig;
}

export const DEFAULT_CONFIG: CocoConfig = {
  port: 11434,
  logLevel: "info",
  modelMap: {},
  agents: [],
  modelMappingPolicy: "compatible",
  lastStarted: null,
  streaming: {
    flushTimeoutMs: 50,
    maxBufferBytes: 1024,
    enableAggressiveFlushing: true,
    enableDiagnostics: false,
    highWaterMark: 16384,
  },
};

function homeDir(): string {
  return Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
}

function envWithLegacy(canonical: string, legacy: string): string | undefined {
  const canonicalValue = Deno.env.get(canonical);
  if (canonicalValue !== undefined) return canonicalValue;

  const legacyValue = Deno.env.get(legacy);
  if (legacyValue !== undefined) {
    console.error(
      `Warning: '${legacy}' is deprecated; use '${canonical}' instead.`,
    );
  }
  return legacyValue;
}

export function configDir(): string {
  const fromEnv = envWithLegacy("ARDO_CONFIG_DIR", "COCO_CONFIG_DIR");
  if (fromEnv && fromEnv.trim()) return fromEnv;

  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return join(home, ".ardo");
}

function legacyConfigDir(): string {
  return join(homeDir(), ".coco");
}

function ardoConfigPath(): string {
  return join(configDir(), "config.json");
}

function legacyConfigPath(): string {
  return join(legacyConfigDir(), "config.json");
}

function configPath(): string {
  return ardoConfigPath();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveConfigPathForLoad(): Promise<string> {
  const canonical = ardoConfigPath();
  if (await fileExists(canonical)) return canonical;

  const legacy = legacyConfigPath();
  if (!await fileExists(legacy)) return canonical;

  // Non-destructive migration: copy legacy config forward if canonical is absent.
  await Deno.mkdir(configDir(), { recursive: true });
  try {
    await Deno.copyFile(legacy, canonical);
    console.error(
      "Warning: Migrated config from ~/.coco/config.json to ~/.ardo/config.json.",
    );
    return canonical;
  } catch {
    console.error(
      "Warning: Using legacy config at ~/.coco/config.json; migration to ~/.ardo/config.json failed.",
    );
    return legacy;
  }
}

function applyEnvOverrides(config: CocoConfig): CocoConfig {
  const portRaw = envWithLegacy("ARDO_PORT", "COCO_PORT");
  const logLevelRaw = envWithLegacy("ARDO_LOG_LEVEL", "COCO_LOG_LEVEL");
  const policyRaw = envWithLegacy(
    "ARDO_MODEL_MAPPING_POLICY",
    "COCO_MODEL_MAPPING_POLICY",
  );

  const next: CocoConfig = { ...config };

  if (portRaw !== undefined) {
    const parsed = parseInt(portRaw, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid ARDO_PORT/COCO_PORT value: ${portRaw}`);
    }
    next.port = parsed;
  }

  if (logLevelRaw !== undefined) {
    next.logLevel = logLevelRaw as LogLevel;
  }

  if (policyRaw !== undefined) {
    next.modelMappingPolicy = policyRaw as ModelMappingPolicy;
  }

  return next;
}

function validate(config: CocoConfig): void {
  if (config.port < 1024 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}. Must be 1024–65535.`);
  }
  const validLevels: LogLevel[] = ["debug", "info", "warn", "error"];
  if (!validLevels.includes(config.logLevel)) {
    throw new Error(`Invalid logLevel: ${config.logLevel}`);
  }
  for (const [k, v] of Object.entries(config.modelMap)) {
    if (!k.trim() || !v.trim()) {
      throw new Error(`modelMap entry has empty key or value: "${k}" → "${v}"`);
    }
  }
  const validPolicies: ModelMappingPolicy[] = ["compatible", "strict"];
  if (!validPolicies.includes(config.modelMappingPolicy)) {
    throw new Error(`Invalid modelMappingPolicy: ${config.modelMappingPolicy}`);
  }
  for (const entry of config.agents) {
    if (
      !entry.agentName.trim() || !entry.configPath.trim() ||
      !entry.endpoint.trim()
    ) {
      throw new Error(
        `ConfigEntry missing required fields for agent "${entry.agentName}"`,
      );
    }
  }

  // Validate streaming configuration
  if (config.streaming) {
    if (config.streaming.flushTimeoutMs < 1 || config.streaming.flushTimeoutMs > 10000) {
      throw new Error(`Invalid streaming.flushTimeoutMs: ${config.streaming.flushTimeoutMs}. Must be 1-10000ms.`);
    }
    if (config.streaming.maxBufferBytes < 64 || config.streaming.maxBufferBytes > 1048576) {
      throw new Error(`Invalid streaming.maxBufferBytes: ${config.streaming.maxBufferBytes}. Must be 64 bytes - 1MB.`);
    }
    if (config.streaming.highWaterMark < 1024 || config.streaming.highWaterMark > 1048576) {
      throw new Error(`Invalid streaming.highWaterMark: ${config.streaming.highWaterMark}. Must be 1024 bytes - 1MB.`);
    }
  }
}

export async function loadConfig(): Promise<CocoConfig> {
  const path = await resolveConfigPathForLoad();
  try {
    const raw = await Deno.readTextFile(path);
    const parsed = JSON.parse(raw) as Partial<CocoConfig>;
    const config: CocoConfig = applyEnvOverrides({
      ...DEFAULT_CONFIG,
      ...parsed,
      // Ensure streaming config has defaults if partially specified
      streaming: {
        ...DEFAULT_CONFIG.streaming,
        ...(parsed.streaming || {}),
      },
    });
    validate(config);
    return config;
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      // First run — create config dir and return defaults
      await Deno.mkdir(configDir(), { recursive: true });
      const config = applyEnvOverrides({ ...DEFAULT_CONFIG });
      validate(config);
      return config;
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse ${path}: ${err.message}`);
    }
    throw err;
  }
}

export async function saveConfig(config: CocoConfig): Promise<void> {
  validate(config);
  await Deno.mkdir(configDir(), { recursive: true });
  await Deno.writeTextFile(
    configPath(),
    JSON.stringify(config, null, 2) + "\n",
  );
}
