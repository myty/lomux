/**
 * Unit tests for src/service/managers/factory.ts
 *
 * Verifies that getServiceManager() returns an object satisfying the
 * ServiceManager interface and that getDaemonManager() satisfies DaemonManager.
 */

import { assertEquals } from "@std/assert";
import { getDaemonManager, getServiceManager } from "@modmux/gateway";

Deno.test("getServiceManager — returns an object with required methods", () => {
  const svc = getServiceManager();
  assertEquals(typeof svc.isInstalled, "function");
  assertEquals(typeof svc.isRunning, "function");
  assertEquals(typeof svc.install, "function");
  assertEquals(typeof svc.uninstall, "function");
  assertEquals(typeof svc.start, "function");
  assertEquals(typeof svc.stop, "function");
});

Deno.test(
  "getServiceManager — accepts home override without throwing",
  () => {
    const svc = getServiceManager({ home: "/tmp/test-home" });
    assertEquals(typeof svc.isInstalled, "function");
  },
);

Deno.test(
  "getServiceManager — isInstalled returns false for a fresh temp home",
  {
    ignore: Deno.build.os !== "darwin" && Deno.build.os !== "linux",
  },
  async () => {
    const home = await Deno.makeTempDir({ prefix: "modmux_factory_test_" });
    try {
      const installed = await getServiceManager({ home }).isInstalled();
      assertEquals(installed, false);
    } finally {
      await Deno.remove(home, { recursive: true }).catch(() => {});
    }
  },
);

Deno.test("getDaemonManager — returns an object with required methods", () => {
  const dm = getDaemonManager();
  assertEquals(typeof dm.isRunning, "function");
  assertEquals(typeof dm.getPid, "function");
  assertEquals(typeof dm.start, "function");
  assertEquals(typeof dm.stop, "function");
});
