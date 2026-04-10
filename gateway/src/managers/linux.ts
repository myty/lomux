import { join } from "@std/path";
import { findFirstBinary } from "../process.ts";
import { UnsupportedPlatformError } from "../autostart.ts";
import type {
  ServiceInstallOptions,
  ServiceInstallResult,
  ServiceUninstallResult,
} from "../autostart.ts";
import type { ServiceManager } from "./interfaces.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_NAME = "modmux.service";
const LEGACY_SERVICE_NAME = "modmux.service";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function homeDir(override?: string): string {
  return override ?? Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
}

function unitPath(home: string): string {
  return join(home, ".config", "systemd", "user", SERVICE_NAME);
}

function legacyUnitPath(home: string): string {
  return join(home, ".config", "systemd", "user", LEGACY_SERVICE_NAME);
}

function logPath(home: string): string {
  return join(home, ".modmux", "modmux.log");
}

function generateUnit(binaryPath: string, log: string): string {
  return `[Unit]
Description=Modmux — GitHub Copilot gateway for coding agents
After=network.target

[Service]
Type=simple
ExecStart=${binaryPath} --daemon
StandardOutput=append:${log}
StandardError=append:${log}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

async function hasSystemctl(): Promise<boolean> {
  try {
    const { code } = await new Deno.Command("systemctl", {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    }).output();
    return code === 0;
  } catch {
    return false;
  }
}

async function runCommand(
  args: string[],
  opts: { ignoreFailure?: boolean } = {},
): Promise<void> {
  const { code } = await new Deno.Command(args[0], {
    args: args.slice(1),
    stdout: "null",
    stderr: "null",
  }).output();
  if (code !== 0 && !opts.ignoreFailure) {
    throw new Error(`Command failed (exit ${code}): ${args.join(" ")}`);
  }
}

// ---------------------------------------------------------------------------
// LinuxServiceManager
// ---------------------------------------------------------------------------

export class LinuxServiceManager implements ServiceManager {
  readonly #home: string;

  constructor(home?: string) {
    this.#home = homeDir(home);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await Deno.stat(unitPath(this.#home));
      return true;
    } catch {
      try {
        await Deno.stat(legacyUnitPath(this.#home));
        return true;
      } catch {
        return false;
      }
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const { code } = await new Deno.Command("systemctl", {
        args: ["--user", "is-active", SERVICE_NAME],
        stdout: "null",
        stderr: "null",
      }).output();
      return code === 0;
    } catch {
      return false;
    }
  }

  async install(
    opts: ServiceInstallOptions = {},
  ): Promise<ServiceInstallResult> {
    if (!await hasSystemctl()) {
      throw new UnsupportedPlatformError("Linux (non-systemd)");
    }

    const home = opts.home ?? this.#home;
    const up = unitPath(home);
    const lp = logPath(home);

    const modmuxPath = await findFirstBinary(["modmux"]);
    if (!modmuxPath) {
      if (opts.dryRun) {
        const configContent = generateUnit("modmux", lp);
        return {
          installed: true,
          binaryPath: "modmux",
          configPath: up,
          configContent,
        };
      }
      throw new Error(
        "'modmux' is not installed globally. Run: deno task install",
      );
    }

    const configContent = generateUnit(modmuxPath, lp);

    if (opts.dryRun) {
      return {
        installed: true,
        binaryPath: modmuxPath as string,
        configPath: up,
        configContent,
      };
    }

    await Deno.mkdir(join(home, ".config", "systemd", "user"), {
      recursive: true,
    });
    await Deno.writeTextFile(up, configContent);

    await runCommand(["systemctl", "--user", "daemon-reload"]);
    await runCommand(["systemctl", "--user", "enable", "--now", SERVICE_NAME]);

    return {
      installed: true,
      binaryPath: modmuxPath as string,
      configPath: up,
      configContent,
    };
  }

  async uninstall(
    opts: ServiceInstallOptions = {},
  ): Promise<ServiceUninstallResult> {
    if (!await hasSystemctl()) {
      throw new UnsupportedPlatformError("Linux (non-systemd)");
    }

    const home = opts.home ?? this.#home;
    const up = unitPath(home);
    const legacy = legacyUnitPath(home);

    let targetUnit = up;

    try {
      await Deno.stat(up);
    } catch {
      try {
        await Deno.stat(legacy);
        targetUnit = legacy;
      } catch {
        return { removed: false };
      }
    }

    if (opts.dryRun) return { removed: true };

    await runCommand(
      ["systemctl", "--user", "disable", "--now", SERVICE_NAME],
      { ignoreFailure: true },
    );

    try {
      await Deno.remove(targetUnit);
    } catch {
      // ignore if already gone
    }

    await runCommand(["systemctl", "--user", "daemon-reload"], {
      ignoreFailure: true,
    });

    return { removed: true };
  }

  async start(): Promise<void> {
    await runCommand(["systemctl", "--user", "start", SERVICE_NAME]);
  }

  async stop(): Promise<void> {
    await runCommand(["systemctl", "--user", "stop", SERVICE_NAME], {
      ignoreFailure: true,
    });
  }
}
