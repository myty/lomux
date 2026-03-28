import { join } from "@std/path";
import { configDir } from "./store.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

function legacyLogPath(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return join(home, ".modmux", "modmux.log");
}

export function getLogPath(): string {
  return join(configDir(), "modmux.log");
}

async function resolveReadableLogPath(): Promise<string> {
  const canonical = getLogPath();
  try {
    await Deno.stat(canonical);
    return canonical;
  } catch {
    return legacyLogPath();
  }
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export async function log(
  level: LogLevel,
  msg: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  });

  const logPath = getLogPath();

  try {
    await Deno.mkdir(configDir(), { recursive: true });
    await Deno.writeTextFile(logPath, entry + "\n", { append: true });
  } catch {
    // no-op when log file is unwritable (e.g. permissions, missing dir)
  }
}

/** Read the last N lines from the log matching a given level. */
export async function readLastLogLines(
  level: LogLevel,
  n: number,
): Promise<string[]> {
  const logPath = await resolveReadableLogPath();
  try {
    const text = await Deno.readTextFile(logPath);
    const lines = text.trim().split("\n").filter((l) => l.trim());
    return lines
      .filter((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.level === level;
        } catch {
          return false;
        }
      })
      .slice(-n);
  } catch {
    return [];
  }
}
