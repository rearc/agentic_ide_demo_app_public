# Dashboard

A personal dashboard of cards: a React frontend over a Flask API, with SQLite. Some cards show live data from public APIs (weather, a quote, NASA's photo of the day), one keeps its own data (todos), and new cards slot in through a small registry on each side.

![Architecture](docs/architecture.drawio.png)

## Prerequisites

- **Python 3.11+.** The backend uses `datetime.UTC`, added in 3.11. A bare `python3` on macOS is often the system 3.9 or a conda `base` 3.10, which fails only later, at `db upgrade`, so build the venv with an explicit interpreter (below).
- **Node.js 22**, pinned in `frontend/.nvmrc`. Use [nvm](https://github.com/nvm-sh/nvm) to match it.
- **[uv](https://github.com/astral-sh/uv)**, only for the random-tools MCP server, not for running the app.
- **[jq](https://jqlang.org)**, needed by the repo's Claude Code hooks: the safety hook blocks every shell command when `jq` is missing. macOS 15 and later include it; earlier macOS: `brew install jq`; Windows: `winget install jqlang.jq`.
- **Windows: Git Bash.** The hooks and the status line in `.claude/` are bash scripts. Claude Code on native Windows runs them through Git Bash when it is installed ([Git for Windows](https://git-scm.com/downloads/win)); without it they run in PowerShell, fail, and the safety hook can block tool calls.

## Environment variables

Copy `.env.example` to `.env` in the project root (`cp .env.example .env`). Both values are optional:

- **`NASA_API_KEY`**: free at [api.nasa.gov](https://api.nasa.gov/). Without it the space card uses NASA's shared `DEMO_KEY`, which is heavily rate limited.
- **`FLASK_SECRET_KEY`**: `backend/config.py` falls back to a development value.

Weather comes from Open-Meteo and quotes from ZenQuotes; neither needs a key. When an external API fails, its card shows a marked fallback instead of an error (ADR-009).

## Setup

### Backend

```bash
cd backend
python3.11 -m venv venv        # or any 3.11+ interpreter, named explicitly
source venv/bin/activate       # Windows (Git Bash): source venv/Scripts/activate
pip install -r requirements-dev.txt   # the app's dependencies plus the test and lint tools
flask --app run.py db upgrade
python seed.py
python run.py                  # http://127.0.0.1:5001
```

`python seed.py` only adds the default cards that are missing, so it is safe to re-run. `python seed.py --reset` wipes all cards and todos and restores the default board (ADR-017).

### Frontend

```bash
cd frontend
nvm use                        # Node 22; `nvm install` the first time
npm install                    # if it reports advisories: `npm audit fix`, never `--force`
npm run dev                    # http://localhost:5173, proxies /api to the backend
```

## Checks

Every suite runs offline: external APIs are mocked, and an unmocked request fails the test.

| What | Where | Command |
|---|---|---|
| Backend tests (pytest, in-memory database) | `backend/`, venv active | `pytest` |
| Backend lint (Ruff) | `backend/`, venv active | `ruff check .` |
| Type check (Pyright, the backend) | repo root, venv active | `pyright` |
| Frontend tests (vitest) | `frontend/` | `npm run test:run` |
| Frontend formatting (Prettier) | `frontend/` | `npm run lint` |
| End-to-end (Playwright) | `frontend/` | `npm run test:e2e` |

- **The frontend needs Node 22.** On an older Node the suite stops with a message instead of reporting zero tests.
- **The end-to-end suite** runs the real app on its own ports (5011 and 5183) against a throwaway database (`backend/instance/e2e.db`), so it never touches your dev servers or your data. It needs the backend venv, and Chromium once: `npx playwright install chromium`.
- Why the suites exist and what they are held to: [ADR-016](docs/adr/ADR-016-test-seam-for-agentic-workflows.md) and [`docs/coding_standards.md`](docs/coding_standards.md).

## Project structure

```
backend/
  app/
    __init__.py         # app factory: blueprints, JSON error handlers, SQLite foreign keys on
    models/             # Base (typed declarative base), Card, Todo
    routes/
      cards.py          # /api/cards
      todos.py          # /api/todos (the todo card's items)
      data.py           # /api/data/<source>: SERVICES maps a source to its service
      helpers.py        # request checks every route uses
    services/           # weather, quotes, space: fetch external data, fall back on failure
  migrations/           # Alembic
  tests/
  config.py             # Config, TestConfig, E2EConfig
  seed.py               # default cards (additive; --reset wipes)
  run.py                # dev server entry point and logging setup

frontend/
  src/
    App.jsx             # header, clock, layout lock
    api.js              # the only module that calls the backend
    components/
      Dashboard.jsx     # the grid; saves a card's layout when it moves
      Card.jsx          # CARD_REGISTRY: a card's source picks its widget
      cards/            # one component per card type
  e2e/                  # Playwright suite

docs/
  adr/                  # architecture decision records
  coding_standards.md   # the review standard, with rule IDs
  app_walkthrough.md    # a guided tour of the code
  DEMO_BRANCHING.md     # how demo runs and teaching defects are branched
```

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/api/cards` | List active cards, in position order |
| GET | `/api/cards/:id` | Get one card |
| POST | `/api/cards` | Create a card (`slug`, `title`, `source` required) |
| PUT | `/api/cards/:id` | Update a card's fields (not its `slug`) |
| DELETE | `/api/cards/:id` | Delete a card and its todos |
| GET | `/api/data/:source` | Live data for a data card; query parameters pass to its service |
| GET | `/api/todos?card_id=:id` | List a todo card's items |
| POST | `/api/todos` | Add an item (`card_id`, `text`) |
| PATCH | `/api/todos/:id` | Update an item's `text` or `done` |
| DELETE | `/api/todos/:id` | Delete an item |

Successes return the object or a bare list; errors return `{"error": "<message>"}` with the status code; deletes return `204` with no body.

## Adding a card

Use the `add-dashboard-card` skill (`.claude/skills/add-dashboard-card/`). A card is a row in `cards`, an entry in `CARD_REGISTRY` (`frontend/src/components/Card.jsx`) and, for a card with live data, an entry in `SERVICES` (`backend/app/routes/data.py`). The two registries agree only through the card's `source` string (ADR-008); a card whose source has no frontend entry says so on the dashboard.

## MCP servers

`.mcp.json` configures two servers for Claude Code: Context7 (documentation lookup) and **random-tools**, a small demo server in `mcp-servers/random-tools-mcp/server.py` with two tools, `coin_flip` and `roll_die` (`sides`, default 6). It is built on the MCP Python SDK 2 (`MCPServer`) and launched over stdio by `uv`, which installs its dependency on first run:

```json
"random-tools": {
  "type": "stdio",
  "command": "uv",
  "args": ["run", "--with", "mcp[cli]>=2,<3", "mcp-servers/random-tools-mcp/server.py"]
}
```
