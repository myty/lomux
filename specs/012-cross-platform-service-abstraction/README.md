---
status: complete
created: 2026-03-17
priority: high
tags:
  - service
  - daemon
  - abstraction
  - macos
  - linux
  - windows
  - cli
  - refactor
created_at: 2026-03-17T02:35:42.453889Z
updated_at: 2026-03-17T02:47:57.389015Z
completed_at: 2026-03-17T02:47:57.389015Z
transitions:
  - status: planned
    at: 2026-03-17T02:47:53.567060Z
  - status: complete
    at: 2026-03-17T02:47:57.389015Z
---

# Cross-Platform Service Abstraction

## Overview

Introduce a unified `ServiceManager` and `DaemonManager` abstraction layer under
`src/service/managers/` that hides all platform differences behind a single
interface. This replaces the current ad-hoc dispatch pattern in `autostart.ts`
and ensures `coco start`, `stop`, `status`, `install-service`, and
`uninstall-service` behave identically across macOS, Windows, and Linux.

## Problem

The current implementation disperses platform-specific logic across
`autostart.ts` as top-level exported functions with inline `Deno.build.os`
switches. There is no formal abstraction — callers import and call functions
directly, making it impossible to inject test doubles, extend to new platforms
without touching shared code, or reason about service vs. daemon mode as a pure
interface contract.

Key gaps:

- No `ServiceManager` or `DaemonManager` interface — platform differences leak
  into callers
- `cli/main.ts` and `service/status.ts` import concrete autostart functions
  directly
- No clean boundary between "system service" and "coco daemon" abstractions

## Requirements

- [ ] **R-001** Define a `ServiceManager` interface with methods:
      `isInstalled()`, `isRunning()`, `install()`, `uninstall()`, `start()`,
      `stop()`.
- [ ] **R-002** Define a `DaemonManager` interface with methods: `isRunning()`,
      `start()`, `stop()`.
- [ ] **R-003** Create `src/service/managers/macos.ts` implementing
      `ServiceManager` for launchd.
- [ ] **R-004** Create `src/service/managers/linux.ts` implementing
      `ServiceManager` for systemd.
- [ ] **R-005** Create `src/service/managers/windows.ts` implementing
      `ServiceManager` for SCM.
- [ ] **R-006** Create `src/service/managers/daemon.ts` implementing
      `DaemonManager` wrapping `service/daemon.ts`.
- [ ] **R-007** Create `src/service/managers/factory.ts` with
      `getServiceManager(): ServiceManager` (dispatches by `Deno.build.os`) and
      `getDaemonManager(): DaemonManager`.
- [ ] **R-008** Create `src/service/managers/mod.ts` as the public module
      boundary exporting interfaces and factory functions.
- [ ] **R-009** Remove public standalone functions from `autostart.ts`; retain
      only shared types (`ServiceInstallOptions`, `ServiceInstallResult`,
      `ServiceUninstallResult`, `UnsupportedPlatformError`).
- [ ] **R-010** Update `src/cli/main.ts` to use `getServiceManager()` and
      `getDaemonManager()` exclusively.
- [ ] **R-011** Update `src/service/status.ts` to use `getServiceManager()` and
      `getDaemonManager()` exclusively.
- [ ] **R-012** `DaemonManager.isRunning()` checks PID file only; `/health`
      probe remains in `getServiceState()`.
- [ ] **R-013** Only one Coco process runs at a time (enforced by manager logic,
      unchanged).
- [ ] **R-014** Add unit tests for the factory
      (`tests/unit/managers/factory_test.ts`) and daemon manager
      (`tests/unit/managers/daemon_test.ts`).
- [ ] **R-015** All existing tests in `autostart_test.ts` and `status_test.ts`
      continue to pass after refactor.
- [ ] **R-016** `deno task quality` (lint + fmt + check + test) passes with zero
      errors.

## Non-Goals

- Internal daemon architecture changes
- Agent implementation
- Config file schema
- Logging behavior
- Port selection logic
- New CLI commands
- New platform support beyond macOS / Linux / Windows

## Technical Notes

### File Layout

```
src/service/managers/
  mod.ts          <- public interface exports + re-exports factory
  factory.ts      <- getServiceManager(), getDaemonManager()
  macos.ts        <- MacOSServiceManager implements ServiceManager
  linux.ts        <- LinuxServiceManager implements ServiceManager
  windows.ts      <- WindowsServiceManager implements ServiceManager
  daemon.ts       <- CocoDaemonManager implements DaemonManager
```

### Interface Signatures

```typescript
interface ServiceManager {
  isInstalled(): Promise<boolean>;
  isRunning(): Promise<boolean>;
  install(opts?: ServiceInstallOptions): Promise<ServiceInstallResult>;
  uninstall(opts?: ServiceInstallOptions): Promise<ServiceUninstallResult>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface DaemonManager {
  isRunning(): Promise<boolean>;
  start(): Promise<StartResult>;
  stop(): Promise<boolean>;
}
```

### Behavior Rules

| Command                  | Logic                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `coco start`             | `serviceManager.isInstalled()` ? `serviceManager.start()` : `daemonManager.start()`          |
| `coco stop`              | `serviceManager.isInstalled()` ? `serviceManager.stop()` : `daemonManager.stop()`            |
| `coco install-service`   | `daemonManager.stop()` + `serviceManager.install()` + `serviceManager.start()`               |
| `coco uninstall-service` | `serviceManager.stop()` + `serviceManager.uninstall()`                                       |
| `coco status`            | `serviceManager.isInstalled()` + `serviceManager.isRunning()` or `daemonManager.isRunning()` |

### Migration Strategy

The macOS, Linux, and Windows logic in `autostart.ts` moves verbatim into the
corresponding manager files. The manager classes call the same helper functions
(plist generation, `runCommand`, `resolveUID`, etc.) which become private to
each platform file. `autostart.ts` retains only the shared type exports.

## Acceptance Criteria

- All interface methods behave correctly on each platform
- CLI commands (`start`, `stop`, `status`, `install-service`,
  `uninstall-service`) behave identically across macOS, Windows, Linux
- Status output is correct in all states
- Only one Coco process runs at a time
- Clean install/uninstall transitions with no leftover processes
- `deno task quality` passes with zero errors
