---
status: complete
created: 2026-03-16
priority: high
tags:
  - service
  - status
  - daemon
  - cli
  - windows
  - macos
  - linux
  - autostart
created_at: 2026-03-16T22:07:04.940158Z
updated_at: 2026-03-16T22:07:04.940158Z
---

# Service Lifecycle and Status Commands v1.1

## Overview

This spec standardizes service lifecycle behavior and status reporting across
coco start, coco stop, coco status, coco install-service, and coco
uninstall-service on macOS, Linux, and Windows.

The objective is to ensure consistent user-facing semantics whether coco is
running as an OS-managed service or as a manually started daemon.

## Problem

Behavior was previously split between daemon-only assumptions and partial
service manager support. This caused ambiguous output and command semantics,
especially when a service was installed but not running.

Key gaps addressed by this spec:

- No explicit installed vs not-installed state in status output
- Divergent start and stop behavior when service manager is present
- Incomplete Windows SCM support for install and uninstall
- Contract tests included stale Windows unsupported-platform expectations

## Requirements

- [x] **R-001** Add service installation state to status model as
      serviceInstalled.
- [x] **R-002** coco status must render four lines in this order: Service,
      State, Agents, Copilot.
- [x] **R-003** Service line must report Installed or Not installed.
- [x] **R-004** State line semantics must be:
- [x] Running at http://localhost:<port> when running is true
- [x] Stopped when serviceInstalled is true and running is false
- [x] Not running when serviceInstalled is false and running is false
- [x] **R-005** coco start must start OS service when installed, otherwise start
      daemon.
- [x] **R-006** coco stop must stop OS service when installed, otherwise stop
      daemon.
- [x] **R-007** coco install-service must stop an existing daemon before
      installation.
- [x] **R-008** Windows install and uninstall must be implemented with
      @cross/service, not task scheduler shortcuts.
- [x] **R-009** Runtime service control must support all platforms:
- [x] macOS via launchctl
- [x] Linux via systemctl --user
- [x] Windows via sc.exe
- [x] **R-010** Keep UnsupportedPlatformError behavior for non-systemd Linux and
      unknown platforms where applicable.
- [x] **R-011** CLI contract tests must no longer assert Windows as unsupported
      for install-service and uninstall-service.
- [x] **R-012** Add unit coverage for status formatter permutations.

## Non-Goals

- Service log management and log rotation
- Boot-time enablement policy beyond install and uninstall lifecycle
- New daemon supervision strategy beyond existing PID and health flow
- Changes to authentication acquisition flow

## Technical Notes

Implementation completed in these areas:

- src/service/autostart.ts
- src/service/status.ts
- src/cli/main.ts
- tests/unit/status_test.ts
- tests/contract/cli-install-service_test.ts

Dependency added:

- jsr:@cross/service

Key design decisions:

- Keep hand-authored macOS and Linux unit definitions for compatibility and
  existing behavior
- Use @cross/service only for Windows service registration and removal
- Preserve Copilot auth line in status output and move it after Service, State,
  and Agents

## Acceptance Criteria

- [x] Full quality gate passes with deno task quality.
- [x] Status output always includes Service, State, Agents, Copilot in order.
- [x] start and stop command behavior is deterministic based on service
      installation state.
- [x] install-service and uninstall-service behavior works across macOS, Linux,
      and Windows paths.
- [x] Unit and contract tests cover new status semantics and updated service
      command expectations.

## Verification

Validated with:

- deno lint
- deno fmt --check
- deno check
- deno test --allow-all

Result:

- All quality checks passed.
- Test suite passed (with existing ignored integration tests unchanged).
