import { stopClient } from "./copilot.ts";
import { shutdownUsageMetrics } from "./usage-metrics.ts";
import { loadConfig, saveConfig } from "./store.ts";
import { log, setLogLevel } from "./log.ts";

export interface ServerConfig {
  port: number;
  hostname: string;
  usageMetrics: {
    persist: boolean;
    snapshotIntervalMs: number;
    filePath: string | null;
  };
}

export async function getConfig(): Promise<ServerConfig> {
  const config = await loadConfig();
  setLogLevel(config.logLevel);

  // Persist lastStarted timestamp
  await saveConfig({ ...config, lastStarted: new Date().toISOString() });

  return {
    port: config.port,
    hostname: "127.0.0.1",
    usageMetrics: config.usageMetrics,
  };
}

export async function shutdown(): Promise<void> {
  log("info", "Server shutting down");
  await shutdownUsageMetrics();
  await stopClient();
}

export function addShutdownHandler(): void {
  Deno.addSignalListener("SIGTERM", async () => {
    await shutdown();
    Deno.exit(0);
  });

  Deno.addSignalListener("SIGINT", async () => {
    await shutdown();
    Deno.exit(0);
  });
}
