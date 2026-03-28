import { loadConfig } from "./store.ts";
import { getStoredToken, isTokenValid } from "../../cli/src/auth.ts";
import { getDaemonManager, getServiceManager } from "./managers/mod.ts";

export interface ServiceState {
  running: boolean;
  serviceInstalled: boolean;
  pid: number | null;
  port: number | null;
  authStatus: "authenticated" | "unauthenticated" | "unknown";
}

/**
 * Compute the current service state by:
 * 1. Checking whether the OS service is installed
 * 2. If installed — checking service running state via OS manager
 * 3. If not installed — reading the PID file and checking liveness + /health
 * 4. Reading Coco config for the port
 * 5. Checking stored token validity
 */
export async function getServiceState(): Promise<ServiceState> {
  const serviceManager = getServiceManager();
  const daemonManager = getDaemonManager();

  const [serviceInstalled, pid, config, token] = await Promise.all([
    serviceManager.isInstalled().catch(() => false),
    daemonManager.getPid(),
    loadConfig().catch(() => null),
    getStoredToken().catch(() => null),
  ]);

  const port = config?.port ?? null;

  let authStatus: ServiceState["authStatus"] = "unknown";
  try {
    authStatus = isTokenValid(token) ? "authenticated" : "unauthenticated";
  } catch {
    authStatus = "unknown";
  }

  if (serviceInstalled) {
    const running = await serviceManager.isRunning().catch(() => false);
    return { running, serviceInstalled, pid: null, port, authStatus };
  }

  // Coco-managed daemon: check PID + /health
  const running = pid !== null;

  // If running, confirm reachability via /health (best-effort)
  if (running && port !== null) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const resp = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        return {
          running: false,
          serviceInstalled,
          pid: null,
          port,
          authStatus,
        };
      }
    } catch {
      // Health check failed — treat as not running
      return { running: false, serviceInstalled, pid: null, port, authStatus };
    }
  }

  return { running, serviceInstalled, pid, port, authStatus };
}

/**
 * Format a ServiceState for human-readable `modmux status` output.
 * agents: list of configured agent names from Modmux config entries
 */
export function formatStatus(state: ServiceState, agents: string[]): string {
  const serviceLine = state.serviceInstalled
    ? "Service:  Installed"
    : "Service:  Not installed";

  let stateLine: string;
  if (state.running && state.port !== null) {
    stateLine = `State:    Running at http://localhost:${state.port}`;
  } else if (state.serviceInstalled) {
    stateLine = "State:    Stopped";
  } else {
    stateLine = "State:    Not running";
  }

  const agentsLine = agents.length > 0
    ? `Agents:   ${agents.join(", ")}`
    : "Agents:   none";

  const authLine = state.authStatus === "authenticated"
    ? "Copilot:  Authenticated \u2713"
    : state.authStatus === "unauthenticated"
    ? "Copilot:  Not authenticated"
    : "Copilot:  Unknown";

  return `${serviceLine}\n${stateLine}\n${agentsLine}\n${authLine}`;
}
