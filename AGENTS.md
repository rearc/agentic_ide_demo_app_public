# Agent instructions — agentic_ide_demo_app

**Default guidance for any contributor** using an agent in this repo: how things are structured, how to run them, and where to make changes. Prefer the **source of truth in code** over narrative docs when they disagree.

**Enforceable conventions live in `.claude/rules/`, not here** — API response shapes (`api-conventions`), styling (`tailwind`, path-scoped to `frontend/**`), DB migrations (`migrations`, path-scoped to `backend/**`), and the security checklist (`security-review`). This file is **orientation, setup, and non-obvious gotchas**; the rules are the authority for conventions, so this file points to them rather than restating them.

## What this project is

A **multi-card dashboard**: a React SPA lists **cards** from the backend; each card loads **live JSON** from `/api/data/<source>`. The UI uses **react-grid-layout**; when the user unlocks the layout, **position and size** are persisted on each card’s `layout` field via `PUT /api/cards/:id`.

## Repository layout

| Area | Role |
|------|------|
| `backend/` | Flask app factory, SQLAlchemy models, REST blueprints, external API “services” |
| `backend/migrations/` | Alembic revisions |
| `backend/run.py` | App entry; runs the dev server when executed |
| `backend/seed.py` | Inserts missing default cards (additive); `--reset` wipes and re-seeds |
| `frontend/` | Vite + React; `src/` holds UI |
| `frontend/src/api.js` | Fetch helpers for `/api/cards` and `/api/data/...` |
| `frontend/src/components/Card.jsx` | Maps `card.source` → widget component + fetches data |
| `frontend/src/components/Dashboard.jsx` | Grid layout, lock/unlock, debounced layout saves |
| `frontend/src/index.css` | Tailwind v4 `@theme` tokens and a few global/keyframe/grid overrides |
| `.env` (repo root, gitignored) | Loaded by `backend/config.py` via `python-dotenv` |
| `.env.example` | Documents `NASA_API_KEY` and `FLASK_SECRET_KEY` |

## Tech stack (verified)

- **Backend:** Python 3.11+, Flask 3.x, Flask-SQLAlchemy, Flask-Migrate, Flask-CORS, `requests`, SQLite (`sqlite:///app.db` in `config.Config`).
- **Frontend:** React 18, Vite 6, **Tailwind CSS v4** via `@tailwindcss/vite`, **react-grid-layout** v2.

## Local development

Run **two processes** (from separate terminals).

**Backend** (working directory `backend/`). Requires **Python 3.11+** (`app/models/*.py` use `datetime.UTC`, added in 3.11); build the venv with an explicit interpreter — a bare `python3` is often macOS system 3.9 or conda `base` 3.10 and fails only later at `db upgrade`:

```bash
python3.11 -m venv venv           # or python3.13; not a bare `python3`
source venv/bin/activate
python --version                  # confirm 3.11+
pip install -r requirements.txt
flask --app run.py db upgrade
python seed.py                    # additive: adds missing default cards only
python seed.py --reset            # destructive: wipes + re-seeds cards/todos
python run.py
```

**Frontend** (working directory `frontend/`). Node version is pinned in `.nvmrc` (22; Node 20 is EOL):

```bash
nvm use                           # or `nvm install` first time
npm install                       # if advisories appear, `npm audit fix` (never --force)
npm run dev
```

**Ports and proxy (source of truth):**

- Flask dev server listens on **port 5001** (`backend/run.py`).
- Vite dev server uses **port 5173** and proxies **`/api`** to `http://127.0.0.1:5001` (`frontend/vite.config.js`).
- The browser should load the UI at `http://localhost:5173`; API calls use relative `/api/...` (`frontend/src/api.js`).

## Environment variables

`backend/config.py` loads **repo-root** `.env` and reads:

- **`NASA_API_KEY`** — optional; NASA APOD uses `DEMO_KEY` when unset (`backend/app/services/space.py`).
- **`FLASK_SECRET_KEY`** — Flask secret; defaults to a dev value in config if unset.

**Do not** commit real secrets. `.gitignore` excludes `.env`.

## Backend architecture (orientation — non-obvious bits only)

- **App factory** `backend/app/__init__.py` registers blueprints under `/api`.
- **`/api/data/<source>`** (`routes/data.py`) dispatches to service callables in the `SERVICES` map; query-string args pass through as **kwargs** (e.g. weather `city`). Services return **flat dicts with graceful fallbacks** (pattern: `services/weather.py`).
- **`Card`** (`models/card.py`) carries `config`/`layout` JSON, orders by `position`; the list route filters `is_active`.
- Response shapes + status codes are governed by **`.claude/rules/api-conventions`** (authority — not restated here).

## Frontend architecture (orientation — non-obvious bits only)

- **Card types:** `Card.jsx` uses `CARD_REGISTRY` keyed by `card.source`; unknown sources fall back to the placeholder entry.
- **Data loading:** for `needsData: true`, `fetchCardData(source, card.config)` builds query params and GETs `/api/data/<source>`.
- **Layout UX:** the dashboard starts **locked**; unlocking enables drag/resize; `onLayoutChange` debounces a `PUT` of `layout: { x, y, w, h }` per card.
- Styling policy — Tailwind-first with narrow exceptions for dynamic CSS vars and `index.css` overrides — is governed by **`.claude/rules/tailwind`** (authority — not restated here).

## How to add a new dashboard “card type”

Adding a card is a multi-step workflow — use the **`add-dashboard-card` skill** (`.claude/skills/add-dashboard-card/`), which is the authority for the archetype decision (data / static / stateful) and every step (backend service → `SERVICES` → frontend widget → `CARD_REGISTRY` → accent token → seed row → migration-if-stateful). Not restated here.

## External APIs (current implementations)

- **Weather:** Open-Meteo + Open-Meteo geocoding — **no API key**; `city` from query/config.
- **Quotes:** `zenquotes.io/api/random` — offline fallback quote in code.
- **Space:** NASA APOD — `NASA_API_KEY` or `DEMO_KEY`.

## Agent behavior expectations

- **Scope:** Change only what the task requires; prefer small, reviewable diffs unless the task explicitly calls for a larger refactor.
- **Verify behavior:** After backend changes, ensure `flask --app run.py db upgrade` and seeds/migrations still make sense. After frontend changes, run `npm run dev` and confirm `/api` proxy matches the Flask port.
- **Secrets & security:** governed by **`.claude/rules/security-review`** (authority — not restated here).
- **Documentation:** If you change ports, proxy targets, or env vars, update `README.md` in the same change when practical.

## MCP servers

This repo connects to external services via the Model Context Protocol. Config lives in **`.mcp.json`** (repo root), read by Claude Code in both the CLI and the VS Code extension. Top-level key is **`mcpServers`**. First use triggers a one-time approval prompt (security gate).

It defines two servers: Context7 (documentation lookup) and a project-local **`random-tools`** demo server (`coin_flip` + `roll_die`; stdio via `uv`).

### Project board

The **GitHub Projects board** sits on top of this repo's GitHub Issues (the issue tracker, see [Agent skills](#agent-skills)) and is what the workshop's board demo drives. How an agent reads and updates it - moving cards, adding decomposed stories, the field model, draft vs real issues - is documented in **[`docs/board_interaction.md`](docs/board_interaction.md)**. Read it before touching the board.

### Team standards documents

The `docs/standards/` directory contains team policy documents that AI agents reference during workflows:

- **`docs/standards/definition_of_ready.md`** -- The team's Definition of Ready checklist. Agents read this file when evaluating whether a ticket is ready for development. See the file's "How this document is used" section for details.

## Agent skills

Per-repo configuration the engineering skills (`to-spec`, `to-tickets`, `triage`, `wayfinder`, `code-review`, `implement`, `domain-modeling`) read at runtime.

### Issue tracker

GitHub Issues on `rearc/agentic_ide_demo_app`, via the `gh` CLI. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

The five canonical roles, each label string equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context — one root `CONTEXT.md` (lazily created) plus `docs/adr/`. See [`docs/agents/domain.md`](docs/agents/domain.md).
