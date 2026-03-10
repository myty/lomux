# Coco

**Universal local AI gateway** — Route any coding agent through GitHub Copilot's API.

Coco runs a local background service that exposes Anthropic-compatible and OpenAI-compatible
API endpoints backed by your GitHub Copilot subscription. Any tool that speaks either API
protocol can be wired through Coco in seconds.

## Features

- 🔗 **Anthropic + OpenAI compatible** — `/v1/messages` and `/v1/chat/completions` endpoints
- 🚀 **Background service** — `coco start` / `coco stop` / `coco restart`
- 🤖 **Multi-agent support** — Claude Code, Cline, Kilo, OpenCode, Goose, Aider, GPT-Engineer
- 🖥️ **Minimal TUI** — bare `coco` opens a radio-toggle interface for batch configuration
- 🔍 **Agent detection** — scans PATH and VS Code extension dirs to find installed agents
- ♻️ **Reversible config** — every `coco configure` is undone by `coco unconfigure`
- ⚡ **Stream support** — real-time streaming responses
- 📦 **Multiple install methods** — npm, Deno/JSR, or direct binary

## How It Works

```
Coding agent → coco proxy (127.0.0.1:11434) → GitHub Copilot API
                │
                ├── POST /v1/messages           (Anthropic)
                ├── POST /v1/chat/completions   (OpenAI)
                ├── GET  /v1/models
                └── GET  /health
```

1. **`coco start`** — authenticates with GitHub and starts the background proxy
2. **`coco configure <agent>`** — writes the agent's config file to point at `http://127.0.0.1:11434`
3. The agent's API calls are translated and forwarded to GitHub Copilot

## Installation

### npm (Recommended)

**Node.js ≥18 required, no Deno installation needed**

```bash
npm install -g coco
```

The npm package automatically downloads the native binary for your platform:

| OS      | Architecture | Status |
|---------|--------------|--------|
| macOS   | arm64        | ✅     |
| macOS   | x64          | ✅     |
| Linux   | x64          | ✅     |
| Linux   | arm64        | ✅     |
| Windows | x64          | ✅     |

### JSR (Deno Runtime)

```bash
deno install -A -g jsr:@myty/coco
```

### Direct Binary Download

Download platform-specific binaries from [GitHub Releases](https://github.com/myty/coco/releases).

## Usage

### TUI (recommended for first-time setup)

```bash
coco          # opens the interactive TUI
```

```
Coco — Local AI Gateway
──────────────────────────────────────────────
Status: Running on http://localhost:11434
Copilot: Authenticated ✓

Agents
──────────────────────────────────────────────
[x] Claude Code      detected
[ ] Cline            installed
[x] Kilo Code        installed
[ ] OpenCode         detected
[ ] Goose            detected
[-] Aider            installed  (misconfigured)
[ ] GPT-Engineer     installed

──────────────────────────────────────────────
Space: toggle   Enter: apply   q: quit
```

Keys: **Space** toggles selection, **Enter** applies, **↑/↓** moves cursor, **q** quits without changes.

### CLI Commands

| Command | Description |
|---|---|
| `coco` | Open the interactive TUI (on TTY) or print status (non-TTY) |
| `coco start` | Start the background proxy service |
| `coco stop` | Stop the background proxy service |
| `coco restart` | Restart the background proxy service |
| `coco status` | Print service and auth status |
| `coco configure <agent>` | Write config for a specific agent |
| `coco unconfigure <agent>` | Revert config for a specific agent |
| `coco doctor` | Scan and report all agents' states |
| `coco models` | List available Copilot model IDs |
| `coco --help` | Show help |
| `coco --version` | Show version |

### Quick Start

```bash
# 1. Start the proxy
coco start
# → Coco is running on http://localhost:11434

# 2. Configure Claude Code
coco configure claude-code
# → claude-code configured.

# 3. Check what's running
coco doctor

# 4. Stop the proxy
coco stop
```

### Supported Agents

| Agent | Binary | Extension |
|---|---|---|
| Claude Code | `claude` | `anthropic.claude-code` |
| Cline | `cline` | `saoudrizwan.claude-dev` |
| Kilo Code | `kilo` | `kilo.kilo-code` |
| OpenCode | `opencode` | `opencode.opencode` |
| Goose | `goose` | `0xgoose.goose` |
| Aider | `aider` | — |
| GPT-Engineer | `gpt-engineer` | — |

## Architecture

```
src/
├── cli/              # Command-line interface (main.ts)
├── server/           # HTTP proxy (router, OpenAI/Anthropic translation)
├── service/          # Daemon lifecycle + status
├── agents/           # Registry, detector, config writers, model map
├── tui/              # Renderer and raw-mode input
├── auth/             # GitHub OAuth device flow
├── copilot/          # GitHub Copilot API client
├── config/           # ~/.coco/config.json store
└── lib/              # Shared utilities (log, process, errors, token)
```

## Prerequisites

- **GitHub Copilot subscription** — Individual, Business, or Enterprise

## Development

```bash
# Clone and run quality checks
git clone https://github.com/myty/coco.git && cd coco
deno task quality

# Run in development mode
deno task dev

# Compile native binary
deno task compile
```

## Troubleshooting

<details>
<summary>Common Issues</summary>

### "Authentication failed"
- Verify you have an active GitHub Copilot subscription
- Try again — device flow tokens sometimes need a moment

### "Port already in use"
- Coco automatically scans for an available port starting from 11434
- Check `coco status` to see the actual port in use

### "Agent is misconfigured"
- Run `coco unconfigure <agent>` then `coco configure <agent>` again
- Run `coco doctor` for a full status report

### macOS "Cannot open" error (binary download)
- Run `xattr -d com.apple.quarantine coco` to remove quarantine

</details>

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- **GitHub** for the Copilot API
- **Anthropic** for Claude Code
- **Deno** for the excellent runtime and tooling
