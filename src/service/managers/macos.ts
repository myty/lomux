import { join } from "@std/path";
import { findBinary } from "../../lib/process.ts";
import type {
  ServiceInstallOptions,
  ServiceInstallResult,
  ServiceUninstallResult,
} from "../autostart.ts";
import type { ServiceManager } from "./interfaces.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLIST_LABEL = "com.coco";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function homeDir(override?: string): string {
  return override ?? Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
}

function plistPath(home: string): string {
  return join(home, "Library", "LaunchAgents", "com.coco.plist");
}

function logPath(home: string): string {
  return join(home, ".coco", "coco.log");
}

function generatePlist(binaryPath: string, log: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${binaryPath}</string>
    <string>--daemon</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
</dict>
</plist>
`;
}

async function resolveUID(): Promise<string> {
  try {
    const { stdout } = await new Deno.Command("id", {
      args: ["-u"],
      stdout: "piped",
      stderr: "null",
    }).output();
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return "$(id -u)";
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
// MacOSServiceManager
// ---------------------------------------------------------------------------

export class MacOSServiceManager implements ServiceManager {
  readonly #home: string;

  constructor(home?: string) {
    this.#home = homeDir(home);
  }

  async isInstalled(): Promise<boolean> {
    try {
      await Deno.stat(plistPath(this.#home));
      return true;
    } catch {
      return false;
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const { code, stdout } = await new Deno.Command("launchctl", {
        args: ["list", PLIST_LABEL],
        stdout: "piped",
        stderr: "null",
      }).output();
      if (code !== 0) return false;
      return new TextDecoder().decode(stdout).includes('"PID"');
    } catch {
      return false;
    }
  }

  async install(
    opts: ServiceInstallOptions = {},
  ): Promise<ServiceInstallResult> {
    const home = opts.home ?? this.#home;
    const pp = plistPath(home);
    const lp = logPath(home);

    const cocoPath = await findBinary("coco");
    if (!cocoPath) {
      throw new Error("coco is not installed globally. Run: deno task install");
    }

    const configContent = generatePlist(cocoPath, lp);

    if (opts.dryRun) {
      return {
        installed: true,
        binaryPath: cocoPath,
        configPath: pp,
        configContent,
      };
    }

    await Deno.mkdir(join(home, "Library", "LaunchAgents"), {
      recursive: true,
    });
    await Deno.writeTextFile(pp, configContent);

    const uid = await resolveUID();
    await runCommand(["launchctl", "bootout", `gui/${uid}`, pp], {
      ignoreFailure: true,
    });
    await runCommand(["launchctl", "bootstrap", `gui/${uid}`, pp]);

    return {
      installed: true,
      binaryPath: cocoPath,
      configPath: pp,
      configContent,
    };
  }

  async uninstall(
    opts: ServiceInstallOptions = {},
  ): Promise<ServiceUninstallResult> {
    const home = opts.home ?? this.#home;
    const pp = plistPath(home);

    try {
      await Deno.stat(pp);
    } catch {
      return { removed: false };
    }

    if (opts.dryRun) return { removed: true };

    const uid = await resolveUID();
    await runCommand(["launchctl", "bootout", `gui/${uid}`, pp], {
      ignoreFailure: true,
    });

    try {
      await Deno.remove(pp);
    } catch {
      // ignore if already gone
    }

    return { removed: true };
  }

  async start(): Promise<void> {
    await runCommand(["launchctl", "start", PLIST_LABEL]);
  }

  async stop(): Promise<void> {
    await runCommand(["launchctl", "stop", PLIST_LABEL], {
      ignoreFailure: true,
    });
  }
}
