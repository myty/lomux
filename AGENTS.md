# Modmux Development Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for project structure, design principles,
contribution workflow, code style, and commands.

## Tech Stack

- **Runtime**: Deno (latest stable), TypeScript strict mode
- **Key deps**: `@std/yaml`, `@std/toml`, `@cliffy/ansi`
- **Auth**: GitHub OAuth 2.0 Device Flow
- **Architecture**: Deno workspace (cli, gateway, providers); background daemon
  via self-spawn (`--daemon` flag); Anthropic + OpenAI proxy translation

## Quality Gate

```bash
deno task quality   # lint + fmt + check + test (must pass before merging)
```

Full command reference in [CONTRIBUTING.md](CONTRIBUTING.md#commands).
