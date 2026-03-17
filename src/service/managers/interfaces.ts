import type {
  ServiceInstallOptions,
  ServiceInstallResult,
  ServiceUninstallResult,
} from "../autostart.ts";
import type { StartResult } from "../daemon.ts";

export interface ServiceManager {
  isInstalled(): Promise<boolean>;
  isRunning(): Promise<boolean>;
  install(opts?: ServiceInstallOptions): Promise<ServiceInstallResult>;
  uninstall(opts?: ServiceInstallOptions): Promise<ServiceUninstallResult>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface DaemonManager {
  isRunning(): Promise<boolean>;
  getPid(): Promise<number | null>;
  start(): Promise<StartResult>;
  stop(): Promise<boolean>;
}
