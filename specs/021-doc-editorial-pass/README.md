---
status: complete
created: 2026-04-10
priority: medium
tags:
- docs
- content
- site
- editorial
created_at: 2026-04-10T11:37:07.001592Z
updated_at: 2026-04-10T11:45:50.162687Z
completed_at: 2026-04-10T11:45:50.162687Z
transitions:
- status: in-progress
  at: 2026-04-10T11:39:37.913541Z
- status: complete
  at: 2026-04-10T11:45:50.162687Z
---

# Documentation Editorial Pass

## Overview

Review all user-facing documentation and site content for verbosity, clarity,
and marketability. The goal is plain, direct writing that earns trust—not copy
that tries to sell. The GitHub repo description sets the tone: _"Local gateway
that routes requests between coding agents and GitHub Copilot. OpenAI and
Anthropic compatible endpoints, reversible configuration, zero external
dependencies."_

Work already done: README intro and site hero/meta updated to match that description.

## Surfaces to Review

| Surface | File | Notes |
|---|---|---|
| README feature list & body | `README.md` | Emoji-heavy feature list, verbose `<details>` sections, overwrought "How It Works" prose |
| Site — Why/What/How sections | `site/index.html` | Post-hero content; check for redundancy and filler |
| Getting started guide | `docs/getting-started.md` | Step-numbering and verification-checkpoint scaffolding may be over-engineered |
| Troubleshooting guide | `docs/troubleshooting.md` | Check for excessive framing before useful content |
| API docs | `docs/api/*.md` | Likely fine; confirm tone consistency |
| Migration guide | `MIGRATION.md` | Check for unnecessary ceremony |
| Style guide | `docs/style-guide.md` | Still references "coco project" (stale branding) |

## Editorial Principles

Apply these consistently across all surfaces:

- **Concrete over abstract** — say what it does, not what it "enables"
- **Short sentences** — cut any sentence that can be split without losing meaning
- **No throat-clearing** — delete preamble that repeats what the heading already says
- **No over-scaffolding** — remove section intros that just restate the section title
- **Earned confidence** — state facts; let the product speak; avoid "powerful", "seamless", "elegant"
- **Match the repo description tone** — direct, functional, no buzzwords

## Plan

- [x] Audit README remaining sections (features, how-it-works, architecture, development, troubleshooting blocks) and reduce verbosity
- [x] Review site `#why`, `#what-it-does`, `#install`, `#how-it-works`, `#faq` sections for redundancy and filler
- [x] Edit `docs/getting-started.md` for conciseness
- [x] Edit `docs/troubleshooting.md` for conciseness
- [x] Review `docs/api/*.md` for tone consistency
- [x] Update `docs/style-guide.md` to fix stale "coco" branding references
- [x] Review `MIGRATION.md` for unnecessary ceremony

## Test

- [x] No stale branding ("coco", "lomux", "claudio") remains in reviewed files
- [x] Each reviewed surface passes the "throat-clearing" check: no section intro merely restates its heading
- [x] README renders cleanly on GitHub (no broken `<details>` nesting)
- [x] Site sections remain accurate against actual CLI behavior after edits

## Notes

AGENTS.md, CLAUDE.md, and GEMINI.md are operational agent instruction files,
not user-facing docs. Exclude from this pass.

CONVENTIONS.md is the project constitution; treat separately if needed.

CHANGELOG.md is append-only and auto-generated in style — exclude.