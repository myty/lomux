import { getDaemonPid, startDaemon, stopDaemon } from "../daemon.ts";
import type { StartResult } from "../daemon.ts";
import type { DaemonManager } from "./interfaces.ts";

export class CocoDaemonManager implements DaemonManager {
  async isRunning(): Promise<boolean> {
    return (await getDaemonPid()) !== null;
  }

  getPid(): Promise<number | null> {
    return getDaemonPid();
  }

  start(): Promise<StartResult> {
    return startDaemon();
  }

  stop(): Promise<boolean> {
    return stopDaemon();
  }
}
