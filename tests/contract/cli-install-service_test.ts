/**
 * Contract tests for coco install-service / uninstall-service CLI commands.
 *
 * Verifies that:
 * - install-service and uninstall-service appear in --help output
 * - Unsupported platform exits 0 with a calm message
 */

import { assertEquals, assertStringIncludes } from "@std/assert";

const CLI_PATH = "./src/cli/main.ts";

// ---------------------------------------------------------------------------
// Help text contracts
// ---------------------------------------------------------------------------

Deno.test({
  name: "CLI --help includes install-service command",
  fn() {
    const process = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", CLI_PATH, "--help"],
    }).outputSync();
    const output = new TextDecoder().decode(process.stdout);
    assertStringIncludes(output, "install-service");
  },
});

Deno.test({
  name: "CLI --help includes uninstall-service command",
  fn() {
    const process = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", CLI_PATH, "--help"],
    }).outputSync();
    const output = new TextDecoder().decode(process.stdout);
    assertStringIncludes(output, "uninstall-service");
  },
});

Deno.test({
  name:
    "CLI --help includes descriptions for install-service and uninstall-service",
  fn() {
    const process = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", CLI_PATH, "--help"],
    }).outputSync();
    const output = new TextDecoder().decode(process.stdout);
    // Both commands should have brief descriptions
    assertStringIncludes(output, "Register daemon");
    assertStringIncludes(output, "Remove daemon");
  },
});

// ---------------------------------------------------------------------------
// Unsupported platform: exit 0 + calm message
// ---------------------------------------------------------------------------

Deno.test({
  name: "install-service on unsupported platform exits 0 with calm message",
  ignore: Deno.build.os === "darwin" || Deno.build.os === "linux",
  fn() {
    const process = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", CLI_PATH, "install-service"],
    }).outputSync();
    const output = new TextDecoder().decode(process.stdout);
    assertEquals(process.code, 0);
    assertStringIncludes(output, "coming soon");
  },
});

Deno.test({
  name: "uninstall-service on unsupported platform exits 0 with calm message",
  ignore: Deno.build.os === "darwin" || Deno.build.os === "linux",
  fn() {
    const process = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-all", CLI_PATH, "uninstall-service"],
    }).outputSync();
    const output = new TextDecoder().decode(process.stdout);
    assertEquals(process.code, 0);
    assertStringIncludes(output, "coming soon");
  },
});
