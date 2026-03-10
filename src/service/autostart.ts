import { join } from "@std/path";
import { findBinary } from "../lib/process.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceInstallOptions {
  /** When true, generate and return config file content without writing or
   *  running any OS commands. Safe to call in tests. */
  dryRun?: boolean;
  /** Override the home directory (default: $HOME / $USERPROFILE). */
  home?: string;
}

export interface ServiceInstallResult {
  /** true = newly installed; false = already was installed */
  installed: boolean;
  /** Absolute path of the coco binary embedded in the service file */
  binaryPath: string;
  /** Path to the plist / systemd unit file written to disk */
  configPath: string;
  /** The generated config file content (always populated, even in dry-run) */
  configContent: string;
}

export interface ServiceUninstallResult {
  /** true = file removed and service deregistered; false = was not installed */
  removed: boolean;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(
      `Autostart service support for ${platform} is coming soon. ` +
        `Run 'coco start' manually after each login.`,
    );
    this.name = "UnsupportedPlatformError";
  }
}

// ---------------------------------------------------------------------------
// Home directory resolution
// ---------------------------------------------------------------------------

function homeDir(override?: string): string {
  return (
    override ??
      Deno.env.get("HOME") ??
      Deno.env.get("USERPROFILE") ??
      "."
  );
}

// ---------------------------------------------------------------------------
// macOS LaunchAgent
// ---------------------------------------------------------------------------

const MACOS_PLIST_LABEL = "com.coco";
const MACOS_LOG_PATH = (home: string) => join(home, ".coco", "coco.log");

function macOSPlistPath(home: string): string {
  return join(home, "Library", "LaunchAgents", "com.coco.plist");
}

function generatePlist(binaryPath: string, logPath: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MACOS_PLIST_LABEL}</string>
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
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${logPath}</string>
</dict>
</plist>
`;
}

async function installMacOS(
  opts: ServiceInstallOptions,
): Promise<ServiceInstallResult> {
  const home = homeDir(opts.home);
  const plistPath = macOSPlistPath(home);
  const logPath = MACOS_LOG_PATH(home);

  const cocoPath = await findBinary("coco");
  if (!cocoPath) {
    throw new Error(
      "coco is not installed globally. Run: deno task install",
    );
  }

  const configContent = generatePlist(cocoPath, logPath);

  if (opts.dryRun) {
    return {
      installed: true,
      binaryPath: cocoPath,
      configPath: plistPath,
      configContent,
    };
  }

  // Ensure LaunchAgents directory exists
  await Deno.mkdir(join(home, "Library", "LaunchAgents"), { recursive: true });
  await Deno.writeTextFile(plistPath, configContent);

  const uid = await resolveUID();

  // bootout first (idempotent — ignore error if not loaded)
  await runCommand(["launchctl", "bootout", `gui/${uid}`, plistPath], {
    ignoreFailure: true,
  });

  // bootstrap to load and start immediately
  await runCommand(["launchctl", "bootstrap", `gui/${uid}`, plistPath]);

  return {
    installed: true,
    binaryPath: cocoPath,
    configPath: plistPath,
    configContent,
  };
}

async function uninstallMacOS(
  opts: ServiceInstallOptions,
): Promise<ServiceUninstallResult> {
  const home = homeDir(opts.home);
  const plistPath = macOSPlistPath(home);

  let fileExists = false;
  try {
    await Deno.stat(plistPath);
    fileExists = true;
  } catch {
    // not installed
  }

  if (!fileExists) return { removed: false };

  if (opts.dryRun) return { removed: true };

  const uid = await resolveUID();
  await runCommand(["launchctl", "bootout", `gui/${uid}`, plistPath], {
    ignoreFailure: true,
  });

  try {
    await Deno.remove(plistPath);
  } catch {
    // ignore if already gone
  }

  return { removed: true };
}

// ---------------------------------------------------------------------------
// Linux systemd user unit
// ---------------------------------------------------------------------------

const LINUX_SERVICE_NAME = "coco.service";
const LINUX_LOG_PATH = (home: string) => join(home, ".coco", "coco.log");

function linuxUnitPath(home: string): string {
  return join(home, ".config", "systemd", "user", LINUX_SERVICE_NAME);
}

function generateSystemdUnit(binaryPath: string, logPath: string): string {
  return `[Unit]
Description=Coco Local AI Gateway
After=network.target

[Service]
Type=simple
ExecStart=${binaryPath} --daemon
StandardOutput=append:${logPath}
StandardError=append:${logPath}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

async function hasSystemctl(): Promise<boolean> {
  try {
    const cmd = new Deno.Command("systemctl", {
      args: ["--version"],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await cmd.output();
    return code === 0;
  } catch {
    return false;
  }
}

async function installLinux(
  opts: ServiceInstallOptions,
): Promise<ServiceInstallResult> {
  if (!await hasSystemctl()) {
    throw new UnsupportedPlatformError("Linux (non-systemd)");
  }

  const home = homeDir(opts.home);
  const unitPath = linuxUnitPath(home);
  const logPath = LINUX_LOG_PATH(home);

  const cocoPath = await findBinary("coco");
  if (!cocoPath) {
    throw new Error(
      "coco is not installed globally. Run: deno task install",
    );
  }

  const configContent = generateSystemdUnit(cocoPath, logPath);

  if (opts.dryRun) {
    return {
      installed: true,
      binaryPath: cocoPath,
      configPath: unitPath,
      configContent,
    };
  }

  await Deno.mkdir(join(home, ".config", "systemd", "user"), {
    recursive: true,
  });
  await Deno.writeTextFile(unitPath, configContent);

  await runCommand(["systemctl", "--user", "daemon-reload"]);
  await runCommand([
    "systemctl",
    "--user",
    "enable",
    "--now",
    LINUX_SERVICE_NAME,
  ]);

  return {
    installed: true,
    binaryPath: cocoPath,
    configPath: unitPath,
    configContent,
  };
}

async function uninstallLinux(
  opts: ServiceInstallOptions,
): Promise<ServiceUninstallResult> {
  if (!await hasSystemctl()) {
    throw new UnsupportedPlatformError("Linux (non-systemd)");
  }

  const home = homeDir(opts.home);
  const unitPath = linuxUnitPath(home);

  let fileExists = false;
  try {
    await Deno.stat(unitPath);
    fileExists = true;
  } catch {
    // not installed
  }

  if (!fileExists) return { removed: false };

  if (opts.dryRun) return { removed: true };

  await runCommand(
    ["systemctl", "--user", "disable", "--now", LINUX_SERVICE_NAME],
    { ignoreFailure: true },
  );

  try {
    await Deno.remove(unitPath);
  } catch {
    // ignore if already gone
  }

  await runCommand(["systemctl", "--user", "daemon-reload"], {
    ignoreFailure: true,
  });

  return { removed: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the Coco daemon with the native OS login service manager.
 *
 * - macOS: writes a LaunchAgent plist and runs `launchctl bootstrap`
 * - Linux (systemd): writes a user unit file and runs `systemctl --user enable --now`
 * - Other: throws UnsupportedPlatformError
 */
export async function installService(
  opts: ServiceInstallOptions = {},
): Promise<ServiceInstallResult> {
  const os = Deno.build.os;
  if (os === "darwin") return await installMacOS(opts);
  if (os === "linux") return await installLinux(opts);
  throw new UnsupportedPlatformError(os === "windows" ? "Windows" : os);
}

/**
 * Deregister the Coco daemon from the OS login service manager.
 * Idempotent — returns `{ removed: false }` if not installed.
 */
export async function uninstallService(
  opts: ServiceInstallOptions = {},
): Promise<ServiceUninstallResult> {
  const os = Deno.build.os;
  if (os === "darwin") return await uninstallMacOS(opts);
  if (os === "linux") return await uninstallLinux(opts);
  throw new UnsupportedPlatformError(os === "windows" ? "Windows" : os);
}

/**
 * Returns true if the service config file exists on disk.
 */
export async function isServiceInstalled(
  opts: Pick<ServiceInstallOptions, "home"> = {},
): Promise<boolean> {
  const home = homeDir(opts.home);
  const os = Deno.build.os;
  let path: string;
  if (os === "darwin") {
    path = macOSPlistPath(home);
  } else if (os === "linux") {
    path = linuxUnitPath(home);
  } else {
    return false;
  }
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveUID(): Promise<string> {
  try {
    const cmd = new Deno.Command("id", {
      args: ["-u"],
      stdout: "piped",
      stderr: "null",
    });
    const { stdout } = await cmd.output();
    return new TextDecoder().decode(stdout).trim();
  } catch {
    return "$(id -u)";
  }
}

async function runCommand(
  args: string[],
  opts: { ignoreFailure?: boolean } = {},
): Promise<void> {
  const cmd = new Deno.Command(args[0], {
    args: args.slice(1),
    stdout: "null",
    stderr: "null",
  });
  const { code } = await cmd.output();
  if (code !== 0 && !opts.ignoreFailure) {
    throw new Error(`Command failed (exit ${code}): ${args.join(" ")}`);
  }
}
