import { UnsupportedPlatformError } from "../autostart.ts";
import type {
  ServiceInstallOptions,
  ServiceInstallResult,
  ServiceUninstallResult,
} from "../autostart.ts";
import type { DaemonManager, ServiceManager } from "./interfaces.ts";
import { CocoDaemonManager } from "./daemon.ts";
import { MacOSServiceManager } from "./macos.ts";
import { LinuxServiceManager } from "./linux.ts";
import { WindowsServiceManager } from "./windows.ts";

// ---------------------------------------------------------------------------
// Fallback for unsupported platforms
// ---------------------------------------------------------------------------

class UnsupportedServiceManager implements ServiceManager {
  isInstalled(): Promise<boolean> {
    return Promise.resolve(false);
  }
  isRunning(): Promise<boolean> {
    return Promise.resolve(false);
  }
  install(_opts?: ServiceInstallOptions): Promise<ServiceInstallResult> {
    return Promise.reject(new UnsupportedPlatformError(Deno.build.os));
  }
  uninstall(_opts?: ServiceInstallOptions): Promise<ServiceUninstallResult> {
    return Promise.resolve({ removed: false });
  }
  start(): Promise<void> {
    return Promise.reject(new UnsupportedPlatformError(Deno.build.os));
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Returns the ServiceManager for the current platform.
 * Accepts an optional `home` override used by macOS and Linux managers
 * (primarily for testing with temporary home directories).
 */
export function getServiceManager(opts?: { home?: string }): ServiceManager {
  const os = Deno.build.os;
  if (os === "darwin") return new MacOSServiceManager(opts?.home);
  if (os === "linux") return new LinuxServiceManager(opts?.home);
  if (os === "windows") return new WindowsServiceManager();
  return new UnsupportedServiceManager();
}

/**
 * Returns the DaemonManager for Coco's PID-based background daemon.
 */
export function getDaemonManager(): DaemonManager {
  return new CocoDaemonManager();
}
