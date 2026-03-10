import { authenticate, getStoredToken, isTokenValid } from "./auth.ts";
import { VERSION } from "../version.ts";
import { startDaemon, stopDaemon } from "../service/daemon.ts";
import { formatStatus, getServiceState } from "../service/status.ts";
import { detectAll } from "../agents/detector.ts";
import { loadConfig } from "../config/store.ts";
import {
  configureAgent,
  isAgentConfigured,
  unconfigureAgent,
} from "../agents/config.ts";
import {
  buildTUIState,
  clearScreen,
  renderDirty,
  renderFull,
} from "../tui/render.ts";
import { disableRawMode, enableRawMode, readKey } from "../tui/input.ts";
import { fetchModelList } from "../copilot/models.ts";

function showHelp() {
  console.log(`
Coco — Local AI Gateway

Usage: coco [COMMAND] [OPTIONS]

Commands:
  (none)              Open the interactive TUI
  start               Start the background proxy service
  stop                Stop the background proxy service
  restart             Restart the background proxy service
  status              Show service and auth status
  configure <agent>   Configure an agent to use Coco
  unconfigure <agent> Revert agent configuration
  doctor              Scan and report all agent states
  models              List available Copilot model IDs

Options:
  --help, -h          Show this help message
  --version, -v       Show version
  --daemon            (internal) Run as background daemon
`.trim());
}

function showVersion() {
  console.log(`Coco v${VERSION}`);
}

export async function ensureAuthenticated(): Promise<boolean> {
  const stored = await getStoredToken();
  if (isTokenValid(stored)) {
    return true;
  }
  try {
    await authenticate();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: Authentication failed: ${message}`);
    return false;
  }
}

async function cmdStart(): Promise<void> {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) Deno.exit(1);
  const result = await startDaemon();
  if (result.already) {
    console.log(`Coco is already running on http://localhost:${result.port}`);
  } else {
    console.log(`Coco is running on http://localhost:${result.port}`);
  }
}

async function cmdStop(): Promise<void> {
  const stopped = await stopDaemon();
  if (stopped) {
    console.log("Coco stopped.");
  } else {
    console.log("Coco is not running.");
  }
}

async function cmdRestart(): Promise<void> {
  const stopped = await stopDaemon();
  if (stopped) console.log("Coco stopped.");
  const authenticated = await ensureAuthenticated();
  if (!authenticated) Deno.exit(1);
  const result = await startDaemon();
  console.log(`Coco is running on http://localhost:${result.port}`);
}

async function cmdStatus(): Promise<void> {
  const state = await getServiceState();
  console.log(formatStatus(state));
  Deno.exit(state.running ? 0 : 1);
}

async function cmdConfigure(agentName: string | undefined): Promise<void> {
  if (!agentName) {
    console.error("Error: 'configure' requires an agent name.");
    console.error("Usage: coco configure <agent>");
    Deno.exit(1);
  }

  const config = await loadConfig();

  if (isAgentConfigured(agentName, config)) {
    console.log(`${agentName} is already configured.`);
    Deno.exit(0);
  }

  let entry;
  try {
    entry = await configureAgent(agentName, config.port, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Unknown agent")) {
      console.error(`Error: Unknown agent "${agentName}".`);
      console.error(
        "Valid agents: claude-code, cline, kilo, opencode, goose, aider, gpt-engineer",
      );
    } else {
      console.error(`Error: ${message}`);
    }
    Deno.exit(1);
  }

  if (entry.validatedAt === null) {
    console.log(
      `${agentName} configured, but validation failed: proxy may not be running.`,
    );
    Deno.exit(2);
  }
  console.log(`${agentName} configured.`);
}

async function cmdUnconfigure(agentName: string | undefined): Promise<void> {
  if (!agentName) {
    console.error("Error: 'unconfigure' requires an agent name.");
    console.error("Usage: coco unconfigure <agent>");
    Deno.exit(1);
  }

  const config = await loadConfig();

  if (!isAgentConfigured(agentName, config)) {
    console.log(`${agentName} is not configured.`);
    Deno.exit(0);
  }

  try {
    await unconfigureAgent(agentName, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }

  console.log(`${agentName} unconfigured.`);
}

async function cmdDoctor(): Promise<void> {
  const divider = "──────────────────────────────────────────────";
  console.log("Coco Doctor");
  console.log(divider);

  const config = await loadConfig();
  const configuredAgents = new Set(
    (config.agents ?? []).map((a) => a.agentName),
  );

  const results = await detectAll();
  for (const { agent, state } of results) {
    const stateLabel = state.padEnd(12);
    const configStatus = configuredAgents.has(agent.name)
      ? "configured ✓"
      : "not configured";
    console.log(`${agent.name.padEnd(16)}${stateLabel} ${configStatus}`);
  }

  console.log(divider);

  // Show last 5 error-level lines from the log file
  const logPath = `${Deno.env.get("HOME") ?? "~"}/.coco/coco.log`;
  let lastErrors = "(none)";
  try {
    const raw = await Deno.readTextFile(logPath);
    const errorLines = raw
      .split("\n")
      .filter(Boolean)
      .filter((line) => {
        try {
          return JSON.parse(line).level === "error";
        } catch {
          return false;
        }
      })
      .slice(-5);
    if (errorLines.length > 0) lastErrors = errorLines.join("\n");
  } catch {
    // log file doesn't exist yet — that's fine
  }

  console.log(`Log: ${logPath}`);
  console.log(`Last 5 errors: ${lastErrors}`);
}

async function cmdModels(): Promise<void> {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) Deno.exit(1);

  const models = await fetchModelList();
  if (models.length === 0) {
    console.error("Error: Could not fetch model list from GitHub Copilot.");
    Deno.exit(1);
  }

  console.log("Available models (via GitHub Copilot):\n");
  for (const id of models) {
    console.log(`  ${id}`);
  }
  console.log("\nRun 'coco configure <agent>' to route an agent through Coco.");
}

async function runTUI(): Promise<void> {
  const [serviceState, config, detectionResults] = await Promise.all([
    getServiceState(),
    loadConfig(),
    detectAll(),
  ]);

  const configuredNames = new Set(config.agents.map((a) => a.agentName));
  // validatedAt === null means misconfigured
  const misconfiguredNames = new Set(
    config.agents.filter((a) => a.validatedAt === null).map((a) => a.agentName),
  );

  let state = buildTUIState(
    serviceState,
    detectionResults,
    configuredNames,
    misconfiguredNames,
  );

  clearScreen();
  renderFull(state);

  let savedTerm = "";
  try {
    savedTerm = await enableRawMode();
  } catch {
    // stty not available (e.g. CI) — fall back to status output
    const st = await getServiceState();
    console.log(formatStatus(st));
    Deno.exit(0);
    return;
  }

  const restore = async () => {
    try {
      await disableRawMode(savedTerm);
    } catch {
      // best-effort
    }
  };

  try {
    while (true) {
      const key = await readKey();

      if (key === "CtrlC" || key === "Quit") {
        // Exit without applying changes
        break;
      }

      if (key === "Up") {
        if (state.cursorIndex > 0) {
          const prev = state.cursorIndex;
          state = { ...state, cursorIndex: state.cursorIndex - 1 };
          renderDirty(state, [prev, state.cursorIndex], state.agents.length);
        }
        continue;
      }

      if (key === "Down") {
        if (state.cursorIndex < state.agents.length - 1) {
          const prev = state.cursorIndex;
          state = { ...state, cursorIndex: state.cursorIndex + 1 };
          renderDirty(state, [prev, state.cursorIndex], state.agents.length);
        }
        continue;
      }

      if (key === "Space") {
        const row = state.agents[state.cursorIndex];
        // Only selectable if installed or detected
        if (row.state !== "not-installed") {
          const agents = state.agents.map((a, i) =>
            i === state.cursorIndex ? { ...a, selected: !a.selected } : a
          );
          state = { ...state, agents };
          renderDirty(state, [state.cursorIndex], state.agents.length);
        }
        continue;
      }

      if (key === "Enter") {
        // Apply changes: configure/unconfigure based on selected state
        await restore();
        clearScreen();

        let applyError = false;
        const freshConfig = await loadConfig();
        for (const row of state.agents) {
          const wasConfigured = freshConfig.agents.some(
            (a) => a.agentName === row.name,
          );
          const wantsConfigured = row.selected;

          if (wantsConfigured && !wasConfigured) {
            try {
              const updated = await loadConfig();
              await configureAgent(row.name, updated.port, updated);
              console.log(`${row.name} configured.`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Error configuring ${row.name}: ${msg}`);
              applyError = true;
            }
          } else if (!wantsConfigured && wasConfigured) {
            try {
              const updated = await loadConfig();
              await unconfigureAgent(row.name, updated);
              console.log(`${row.name} unconfigured.`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Error unconfiguring ${row.name}: ${msg}`);
              applyError = true;
            }
          }
        }

        Deno.exit(applyError ? 1 : 0);
        return;
      }
    }
  } finally {
    await restore();
    // Show cursor and move to new line after TUI exits
    Deno.stdout.writeSync(new TextEncoder().encode("\x1b[?25h\n"));
  }
}

async function main() {
  const args = Deno.args;

  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    Deno.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    showVersion();
    Deno.exit(0);
  }

  // --daemon flag: run as background service
  if (args.includes("--daemon")) {
    const { startServer } = await import("../server/router.ts");
    const authenticated = await ensureAuthenticated();
    if (!authenticated) Deno.exit(1);
    await startServer();
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case "start":
      await cmdStart();
      break;
    case "stop":
      await cmdStop();
      break;
    case "restart":
      await cmdRestart();
      break;
    case "status":
      await cmdStatus();
      break;
    case "configure":
      await cmdConfigure(args[1]);
      break;
    case "unconfigure":
      await cmdUnconfigure(args[1]);
      break;
    case "doctor":
      await cmdDoctor();
      break;
    case "models":
      await cmdModels();
      break;
    default:
      // T038: non-TTY bare invocation → print status and exit 0
      if (!Deno.stdout.isTerminal()) {
        const state = await getServiceState();
        console.log(formatStatus(state));
        Deno.exit(0);
        return;
      }
      // T037: TTY bare invocation → open TUI
      await runTUI();
  }
}

if (import.meta.main) {
  await main();
}
