# Architecture Decision Records - agentic_ide_demo_app

Architectural decisions for the multi-card personal dashboard. Each ADR captures the
"why" behind a choice that cannot be inferred from the code alone.

Decisions are stored **one file per decision** (`ADR-NNN-<slug>.md`) so an agent can
open just the relevant record for the work at hand without reading every decision. The
grill and plan phases of the SDLC flow read these; keep them focused.

## Index

| ADR | Decision | Status |
|-----|----------|--------|
| [001](ADR-001-not-production-ready-by-design.md) | Not Production-Ready by Design | Accepted |
| [002](ADR-002-flask-over-django.md) | Flask Over Django | Accepted |
| [003](ADR-003-sqlite-database.md) | SQLite as the Database | Accepted |
| [004](ADR-004-react-with-vite.md) | React with Vite for the Frontend | Accepted |
| [005](ADR-005-plain-javascript-no-typescript.md) | Plain JavaScript, No TypeScript | Accepted |
| [006](ADR-006-spa-api-separation.md) | SPA + API Separation Over Monolith | Accepted |
| [007](ADR-007-react-grid-layout.md) | react-grid-layout for the Dashboard Grid | Accepted |
| [008](ADR-008-service-dispatch-card-registry.md) | Service Dispatch and Card Registry Pattern | Accepted |
| [009](ADR-009-graceful-api-fallbacks.md) | Graceful API Fallbacks Over Exceptions | Accepted |
| [010](ADR-010-no-automated-tests.md) | No Automated Tests | Superseded by ADR-016 |
| [011](ADR-011-no-authentication.md) | No Authentication or User Management | Accepted |
| [012](ADR-012-latest-dependency-versions.md) | Latest Dependency Versions Across the Stack | Accepted |
| [013](ADR-013-json-columns-config-layout.md) | JSON Columns for Card Configuration and Layout | Accepted |
| [014](ADR-014-destructive-seed-script.md) | Destructive Seed Script | Superseded by ADR-017 |
| [015](ADR-015-repo-rename-agentic-ide-demo-app.md) | Repo Rename to agentic_ide_demo_app | Accepted |
| [016](ADR-016-test-seam-for-agentic-workflows.md) | A Test Seam for Agentic Workflows | Accepted (supersedes ADR-010) |
| [017](ADR-017-additive-seed-with-explicit-reset.md) | Additive Seed with an Explicit Reset | Accepted (supersedes ADR-014) |
| [018](ADR-018-clean-main-planted-defects-on-branches.md) | A Clean `main`, with Teaching Defects on Branches | Accepted |

## Adding a new ADR

1. Copy the format of any existing ADR: H1 `# ADR-NNN: Title`, then `**Date:**` /
   `**Status:**`, then `## Context`, `## Decision`, `## Consequences`.
2. Number sequentially (`ADR-016-...`) with a short kebab-case slug in the filename.
3. Add a row to the index table above.
4. Never edit the substance of an accepted ADR after the fact. If a decision is
   reversed or replaced, add a new ADR and mark the old one `Superseded by ADR-NNN`.

See [`ADR_CREATION_PROMPT.md`](../../ADR_CREATION_PROMPT.md) at the repo root for the
interactive drafting prompt.
</content>
