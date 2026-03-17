/**
 * Unit tests for src/service/managers/daemon.ts (CocoDaemonManager)
 *
 * These tests verify isRunning() and getPid() behave correctly when the
 * PID file does not exist — no live process is required.
 */

import { assertEquals } from "@std/assert";
import { getDaemonManager } from "../../../src/service/managers/mod.ts";

Deno.test(
  "DaemonManager.isRunning — returns false when no PID file exists",
  async () => {
    // Override HOME to a fresh temp dir so no PID file can exist
    const tempHome = await Deno.makeTempDir({
      prefix: "coco_daemon_test_",
    });
    const originalHome = Deno.env.get("HOME");
    Deno.env.set("HOME", tempHome);
    try {
      const dm = getDaemonManager();
      const running = await dm.isRunning();
      assertEquals(running, false);
    } finally {
      if (originalHome !== undefined) {
        Deno.env.set("HOME", originalHome);
      } else {
        Deno.env.delete("HOME");
      }
      await Deno.remove(tempHome, { recursive: true }).catch(() => {});
    }
  },
);

Deno.test(
  "DaemonManager.getPid — returns null when no PID file exists",
  async () => {
    const tempHome = await Deno.makeTempDir({
      prefix: "coco_daemon_test_",
    });
    const originalHome = Deno.env.get("HOME");
    Deno.env.set("HOME", tempHome);
    try {
      const dm = getDaemonManager();
      const pid = await dm.getPid();
      assertEquals(pid, null);
    } finally {
      if (originalHome !== undefined) {
        Deno.env.set("HOME", originalHome);
      } else {
        Deno.env.delete("HOME");
      }
      await Deno.remove(tempHome, { recursive: true }).catch(() => {});
    }
  },
);
