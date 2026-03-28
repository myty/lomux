# Modmux

Modmux is the model multiplexing layer for coding agents. It provides a unified,
local interface for routing requests across multiple model providers and
protocols. Built for reliability, clarity, and modern multi-agent workflows,
Modmux normalizes differences between APIs so your agents can focus on logic—not
plumbing.

Website: https://myty.github.io/modmux/

Migration guide: [MIGRATION.md](MIGRATION.md) Release notes:
[CHANGELOG.md](CHANGELOG.md)

## Features

- 🔗 **Anthropic + OpenAI compatible** — `/v1/messages` and
  `/v1/chat/completions` endpoints, plus `/v1/responses`
- 🧮 **Token counting endpoint** — `POST /v1/messages/count_tokens` for
  supported Anthropic-compatible flows
- 📊 **Usage telemetry endpoint** — `GET /v1/usage` for aggregated request,
  status, and latency metrics
- 🚀 **Background service** — `modmux start` / `modmux stop` / `modmux restart`
- 🤖 **Multi-agent support** — Claude Code, Cline, and Codex
- 🖥️ **Minimal TUI** — bare `modmux` opens a radio-toggle interface for batch
  configuration
- 🔍 **Agent detection** — scans PATH and VS Code extension dirs to find
  installed agents
- ♻️ **Reversible config** — every `modmux configure` is undone by
  `modmux unconfigure`
- ⚡ **Stream support** — real-time streaming responses
- 📦 **Multiple install methods** — npm, Deno/JSR, or direct binary

## How It Works

```
Coding agent → Modmux proxy (127.0.0.1:11434) → GitHub Copilot API
                │
                ├── POST /v1/messages           (Anthropic)
                ├── POST /v1/messages/count_tokens
                ├── POST /v1/chat/completions   (OpenAI)
                ├── POST /v1/responses          (OpenAI)
                ├── GET  /v1/usage
                ├── GET  /v1/models
                └── GET  /health
```

1. **`modmux start`** — authenticates with GitHub and starts the background
   proxy
2. **`modmux configure <agent>`** — writes the agent's config file to point at a
   local Modmux endpoint
3. The agent's API calls are translated and forwarded to GitHub Copilot
4. You can inspect state with `modmux status`, `GET /health`, and
   `GET /v1/usage`

## Installation

<details>
<summary>📖 npm (Recommended, No Deno Required)</summary>

**Node.js ≥18 required**

```bash
npm install -g @modmux/core
```

The npm package automatically downloads the native binary for your platform:

| OS      | Architecture | Status |
| ------- | ------------ | ------ |
| macOS   | arm64        | ✅     |
| macOS   | x64          | ✅     |
| Linux   | x64          | ✅     |
| Linux   | arm64        | ✅     |
| Windows | x64          | ✅     |

</details>

<details>
<summary>📖 From Source (Development / Try It Out)</summary>

Clone the repository and install globally with a single command:

```bash
git clone https://github.com/myty/modmux.git && cd modmux
```

**With Deno:**

```bash
deno task install
```

**With mise:**

```bash
mise run install
```

After installation, `modmux` is available in any terminal:

```bash
modmux --version
# Modmux v0.3.0
```

</details>

> **Note**: Ensure `~/.deno/bin` is in your `PATH`. The Deno installer adds this
> automatically.

<details>
<summary>📖 JSR (Deno Runtime)</summary>

```bash
[Optional] deno install -A -g jsr:@modmux/cli
```

</details>

<details>
<summary>📖 Direct Binary Download</summary>

Download platform-specific binaries from
[GitHub Releases](https://github.com/myty/modmux/releases).

</details>

## Usage

<details>
<summary>📖 TUI (recommended for first-time setup)</summary>

```bash
modmux          # opens the interactive TUI
```

```
modmux — Model Multiplexing Layer
─────────────────────────────────────────────
Status: Running on http://localhost:11434
Copilot: Authenticated ✓

Agents
─────────────────────────────────────────────
[x] Claude Code      detected
[ ] Cline            installed
[ ] Codex            installed

─────────────────────────────────────────────
Space: toggle   Enter: apply   q: quit
```

Keys: **Space** toggles selection, **Enter** applies, **↑/↓** moves cursor,
**q** quits without changes.

</details>

<details>
<summary>📖 CLI Commands</summary>

| Command                          | Description                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| `modmux`                         | Open the interactive TUI (on TTY) or print status (non-TTY) |
| `modmux start`                   | Start the background proxy service                          |
| `modmux stop`                    | Stop the background proxy service                           |
| `modmux restart`                 | Restart the background proxy service                        |
| `modmux status`                  | Print service and auth status                               |
| `modmux configure <agent>`       | Write config for a specific agent                           |
| `modmux unconfigure <agent>`     | Revert config for a specific agent                          |
| `modmux doctor`                  | Scan and report all agents' states                          |
| `modmux models`                  | List available Copilot model IDs                            |
| `modmux model-policy [compatible | strict]`                                                    |
| `modmux install-service`         | Register daemon with OS login service manager               |
| `modmux uninstall-service`       | Remove daemon from OS login service manager                 |
| `modmux --help`                  | Show help                                                   |
| `modmux --version`               | Show version                                                |

</details>

<details>
<summary>🚀 Quick Start</summary>

```bash
# 1. Install Modmux
npm install -g @modmux/core

# 2. Start the proxy (authenticates with GitHub Copilot on first run)
modmux start

# 3. Configure an agent
modmux configure claude-code

# 4. Check what's running
modmux doctor

# 5. (Optional) Register as a login service
modmux install-service

# To remove the login service later:
# modmux uninstall-service
```

</details>

<details>
<summary>📖 Usage Metrics API</summary>

Modmux exposes a local metrics snapshot endpoint:

```bash
curl http://127.0.0.1:11434/v1/usage
```

Response shape:

```json
{
  "process": {
    "started_at": "2026-03-23T00:00:00.000Z",
    "updated_at": "2026-03-23T00:01:00.000Z"
  },
  "totals": {
    "requests": 0,
    "success": 0,
    "errors": 0
  },
  "endpoints": {
    "/v1/messages": {
      "calls": 0,
      "status": { "2xx": 0, "4xx": 0, "5xx": 0 },
      "latency_ms": { "count": 0, "min": 0, "max": 0, "avg": 0 }
    }
  },
  "models": {},
  "agents": {}
}
```

Persistence is optional and configurable via `~/.modmux/config.json`:

```json
{
  "usageMetrics": {
    "persist": false,
    "snapshotIntervalMs": 60000,
    "filePath": null
  }
}
```

</details>

<details>
<summary>📖 Supported Agents</summary>

| Agent       | Binary   | Extension                |
| ----------- | -------- | ------------------------ |
| Claude Code | `claude` | `anthropic.claude-code`  |
| Cline       | `cline`  | `saoudrizwan.claude-dev` |
| Codex       | `codex`  | —                        |

</details>

## Architecture

```
modmux/
├── cli/              # Command-line interface (main.ts)
├── gateway/          # HTTP proxy (router, OpenAI/Anthropic translation)
├── providers/        # Model backend integrations (Copilot)
└── site/             # Website
```

## Prerequisites

- **GitHub Copilot subscription** — Individual, Business, or Enterprise

## Development

```bash
# Clone and run quality checks
git clone https://github.com/myty/modmux.git && cd modmux
deno task quality

# Run in development mode
deno task dev

# Compile native binary
deno task compile
```

## Troubleshooting

<details>
<summary>Common Issues</summary>

<details>
<summary>📖 "Authentication failed"</summary>

- Verify you have an active GitHub Copilot subscription
- Try again — device flow tokens sometimes need a moment

</details>

<details>
<summary>📖 "Port already in use"</summary>

- Modmux automatically scans for an available port starting from 11434
- Check `modmux status` to see the actual port in use

</details>

<details>
<summary>🔧 "Agent is misconfigured"</summary>

- Run `modmux unconfigure <agent>` then `modmux configure <agent>` again
- Run `modmux doctor` for a full status report

</details>

<details>
<summary>📖 macOS "Cannot open" error (binary download)</summary>

- Run `xattr -d com.apple.quarantine modmux` to remove quarantine

</details>

</details>

## License

MIT License.

## Acknowledgments

- **GitHub** for the Copilot API
- **Anthropic** for Claude Code
- **Deno** for the excellent runtime and tooling
