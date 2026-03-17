// ---------------------------------------------------------------------------
// Shared types for service manager implementations.
// Platform logic lives in src/service/managers/.
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

export class UnsupportedPlatformError extends Error {
  constructor(platform: string) {
    super(
      `Autostart service support for ${platform} is coming soon. ` +
        `Run 'coco start' manually after each login.`,
    );
    this.name = "UnsupportedPlatformError";
  }
}
