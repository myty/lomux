# Modmux

The model multiplexing layer for coding agents. Unified local interface for
routing requests across multiple model providers and protocols.

## Installation

```bash
npm install -g @modmux/core
```

## Supported Platforms

| Platform | Architecture | npm Package            |
| -------- | ------------ | ---------------------- |
| macOS    | arm64        | `@modmux/darwin-arm64` |
| macOS    | x64          | `@modmux/darwin-x64`   |
| Linux    | x64          | `@modmux/linux-x64`    |
| Linux    | arm64        | `@modmux/linux-arm64`  |
| Windows  | x64          | `@modmux/win32-x64`    |

## How it works

When you run `modmux`, the shim:

1. Detects your platform and resolves the matching `@modmux/<os>-<arch>`
   optional dependency
2. Runs the native binary directly — no Deno runtime required
3. If no platform binary is available, falls back to `deno run jsr:@modmux/cli`
   (requires [Deno](https://deno.land) installed)
4. If neither is available, prints an error with a link to manual download

## Manual Download

Download pre-built binaries from the
[GitHub Releases](https://github.com/myty/modmux/releases) page.
