// Public module boundary for src/service/managers/
// Import from here instead of individual platform files.

export type { DaemonManager, ServiceManager } from "./interfaces.ts";
export { getDaemonManager, getServiceManager } from "./factory.ts";

// Re-export shared types used in the interface signatures
export type {
  ServiceInstallOptions,
  ServiceInstallResult,
  ServiceUninstallResult,
} from "../autostart.ts";
export { UnsupportedPlatformError } from "../autostart.ts";
export type { StartResult } from "../daemon.ts";
