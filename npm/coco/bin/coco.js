#!/usr/bin/env node
// deno-lint-ignore-file
"use strict";

const { spawnSync } = require("child_process");

// Map Node.js platform+arch to @coco/* package name
const PLATFORM_MAP = {
  "darwin arm64": "@coco/darwin-arm64",
  "darwin x64": "@coco/darwin-x64",
  "linux x64": "@coco/linux-x64",
  "linux arm64": "@coco/linux-arm64",
  "win32 x64": "@coco/win32-x64",
};

const platformKey = `${process.platform} ${process.arch}`;
const pkgName = PLATFORM_MAP[platformKey];

if (pkgName) {
  const binaryName = process.platform === "win32" ? "coco.exe" : "coco";
  let binaryPath;
  try {
    binaryPath = require.resolve(`${pkgName}/bin/${binaryName}`);
  } catch (_e) {
    binaryPath = null;
  }

  if (binaryPath) {
    const result = spawnSync(binaryPath, process.argv.slice(2), {
      stdio: "inherit",
      shell: false,
    });
    process.exit(result.status ?? 1);
  }
}

// Fallback: try deno with JSR package
const denoCheck = spawnSync("deno", ["--version"], {
  stdio: "ignore",
  shell: false,
});

if (denoCheck.status === 0) {
  const result = spawnSync(
    "deno",
    ["run", "-A", "jsr:@myty/coco", ...process.argv.slice(2)],
    { stdio: "inherit", shell: false },
  );
  process.exit(result.status ?? 1);
}

// Neither platform binary nor deno available
console.error(
  `Coco is not supported on this platform (${process.platform}/${process.arch}).\n` +
    `Please download a binary from https://github.com/myty/coco/releases or install Deno.`,
);
process.exit(1);
