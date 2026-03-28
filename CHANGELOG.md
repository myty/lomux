# Changelog

All notable changes to this project are documented in this file.

## 0.2.0 - 2026-03-21

### Changed

- Renamed project identity from Coco to Ardo across runtime, docs, and
  distribution assets.
- Switched canonical CLI command from `coco` to `ardo`.
- Switched canonical config/state path from `~/.coco` to `~/.ardo`.
- Switched canonical environment prefix from `COCO_*` to `ARDO_*`.
- Updated release artifacts and npm distribution pipeline to Ardo naming.

### Added

- Added compatibility fallback for legacy Coco paths and environment variables.
- Added root migration guide: [MIGRATION.md](MIGRATION.md).

### Deprecated

- Legacy Coco compatibility (`coco` command and `COCO_*` variables) will be
  removed in `1.0.0`.

## 0.3.0 - 2026-03-27

### Changed

- Renamed project identity from Ardo back to Coco across runtime, docs, and
  distribution assets.
- Switched canonical CLI command from `ardo` back to `coco`.
- Switched canonical config/state path from `~/.ardo` back to `~/.coco`.
- Switched canonical environment prefix from `ARDO_*` back to `COCO_*`.
- Updated npm distribution package from `@myty/ardo` back to `@myty/coco`.

### Deprecated

- All Ardo compatibility (`ardo` command and `ARDO_*` variables) have been
  removed. Use `coco` and `COCO_*` environment variables.
