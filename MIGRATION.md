# Migration Guide: Coco -> Modmux

This project has been renamed from **Coco** to **Modmux**.

Modmux is the canonical project name, command name, package name, and
configuration namespace.

## What Changed

- Project and repository identity moved to Modmux.
- Canonical CLI command is now `modmux`.
- Canonical config/state directory is now `~/.modmux`.
- Canonical environment variables now use `MODMUX_`.
- npm package `@modmux/core` is now canonical.
- npm package `@myty/coco` has been discontinued; use `@modmux/core` instead.

## Before/After Mapping

| Area             | Before                 | After                    |
| ---------------- | ---------------------- | ------------------------ |
| Repository       | `github.com/myty/coco` | `github.com/myty/modmux` |
| CLI command      | `coco`                 | `modmux`                 |
| Deno/JSR install | `jsr:@myty/coco`       | `jsr:@modmux/cli`        |
| npm package      | `@myty/coco`           | `@modmux/core`           |
| Config directory | `~/.coco`              | `~/.modmux`              |
| PID file         | `~/.coco/coco.pid`     | `~/.modmux/modmux.pid`   |
| Log file         | `~/.coco/coco.log`     | `~/.modmux/modm.log`     |
| Env prefix       | `COCO_*`               | `MODMUX_*`               |

## Upgrade Steps

1. Install the canonical CLI.

```bash
npm install -g @modmux/core
```

Or with Deno:

```bash
deno install --global --allow-all -n modmux jsr:@modmux/cli
```

2. Update scripts and automation from `coco` to `modmux`.

3. Update environment variables from `COCO_*` to `MODMUX_*`.

4. Move any direct path references from `~/.coco` to `~/.modmux`.

## Compatibility Behavior

- Running `coco` no longer works; use `modmux` instead.
- `COCO_*` variables are no longer supported; use `MODMUX_*` variables instead.
- Existing data under `~/.coco` is not automatically migrated; manual migration
  may be required.

---

# Migration Guide: Ardo -> Coco

This repository has been renamed from **Ardo** back to **Coco**.

Coco is now the canonical project name, command name, package name, and
configuration namespace.

## What Changed

- Project and repository identity moved back to Coco and myty.
- Canonical CLI command is now `coco`.
- Canonical config/state directory is now `~/.coco`.
- Canonical environment variables now use `COCO_`.
- npm package `@myty/coco` is now canonical.
- npm package `@myty/ardo` has been discontinued; use the canonical `@myty/coco`
  package.

## Before/After Mapping

| Area             | Before                     | After                  |
| ---------------- | -------------------------- | ---------------------- |
| Repository       | `github.com/ardo-org/ardo` | `github.com/myty/coco` |
| CLI command      | `ardo`                     | `coco`                 |
| Deno/JSR install | `jsr:@ardo-org/ardo`       | `jsr:@myty/coco`       |
| npm package      | `@myty/ardo`               | `@myty/coco`           |
| Config directory | `~/.ardo`                  | `~/.coco`              |
| PID file         | `~/.ardo/ardo.pid`         | `~/.coco/coco.pid`     |
| Log file         | `~/.ardo/ardo.log`         | `~/.coco/coco.log`     |
| Env prefix       | `ARDO_*`                   | `COCO_*`               |

## Upgrade Steps

1. Install the canonical CLI.

```bash
npm install -g @myty/coco
```

Or with Deno:

```bash
deno install --global --allow-all -n coco jsr:@myty/coco
```

2. Update scripts and automation from `ardo` to `coco`.

3. Update environment variables from `ARDO_*` to `COCO_*`.

4. Move any direct path references from `~/.ardo` to `~/.coco`.

## Compatibility Behavior

- Running `ardo` no longer works; use `coco` instead.
- `ARDO_*` variables are no longer supported; use `COCO_*` variables instead.
- Existing data under `~/.ardo` is not automatically migrated; manual migration
  may be required.
