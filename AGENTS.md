# Agent instructions: agentic_ide_demo_app

A personal dashboard of cards: a React SPA in `frontend/` over a Flask API in `backend/`, with SQLite. Setup, the API table and the project layout are in `README.md`; the architecture is drawn in `docs/architecture.drawio.png`. When this file and the code disagree, the code wins: say so.

## Commands

Run the ones that cover what you changed, and show their output before you call a task done.

| Check | From | Command |
|---|---|---|
| Backend tests | `backend/`, venv active (`source venv/bin/activate`; Windows `venv\Scripts\activate`) | `pytest` |
| Backend lint | `backend/`, venv active | `ruff check .` |
| Type check | repo root, venv active | `pyright` (must report 0 errors) |
| Frontend tests | `frontend/` | `npm run test:run` |
| Frontend formatting | `frontend/` | `npm run lint` |
| End-to-end | `frontend/` | `npm run test:e2e` |

- Your shell may not have the right versions: the backend needs the venv's Python (3.11+), the frontend Node 22 (`nvm use` in `frontend/`). If the frontend suite stops on its Node check, switch Node; it is not a test failure.
- Dev servers: `python run.py` (port 5001) and `npm run dev` (port 5173, proxies `/api` to 5001). The end-to-end suite starts its own on other ports, with its own database.
- **In a git worktree** (`.claude/worktrees/<name>/`), run `node scripts/worktree-setup.mjs` from its root before anything else: it links the main checkout's venv and `node_modules`, builds the worktree's own database, and writes the worktree's own four ports to `.dev-ports`. The dev servers, the end-to-end suite and `check-ui` read that file, so the commands above run unchanged and never collide with the main checkout's servers.

## How the app fits together

- **Adding a card:** use the `add-dashboard-card` skill. A card is a row in `cards`, an entry in `CARD_REGISTRY` (`frontend/src/components/Card.jsx`) and, for live data, an entry in `SERVICES` (`backend/app/routes/data.py`). The two registries agree only through the card's `source` string (ADR-008): change one, check the other. A seeded card's place goes in `DEFAULT_BOARD` (`backend/seed.py`).
- **Specs:** a spec for a change goes in `specs/<slug>/spec.md`, with `plan.md` beside it when the build runs over more than one session; when a change splits into tasks worked by several sessions, each task gets its own spec in `specs/<slug>/tasks/`. `specs/README.md` says what each holds. Plan Mode's drafts in `plans/` are never committed; the plan is `specs/<slug>/plan.md`.
- **Checking a UI change:** use the `check-ui` skill: layout facts as text at every width, one contact sheet for design questions. Page states live in `frontend/e2e/ui-states.js`.
- **Network:** `frontend/src/api.js` is the only module that calls the backend; components never call `fetch`.
- **Requests:** routes check bodies and ids with `backend/app/routes/helpers.py` and fail with `abort(status, message)`; the app factory turns every error into `{"error": message}`.
- **External APIs:** each service in `backend/app/services/` returns a flat dict and never raises; on failure it returns the same keys plus `"fallback": true` (ADR-009).
- **Data:** models subclass the typed `Base`; query through `db.session`, never `Model.query`. A profile is a named board: `profile_cards` holds each card's `x`, `y`, `w`, `h` and `hidden` on it, and `cards` has no layout (ADR-019). Deleting a card deletes its todos and its board entries; deleting a profile deletes its entries (foreign keys are on). `python seed.py` adds missing default cards (placed via `DEFAULT_BOARD`, on "Default" only) and creates "Default" if no profile exists; `python seed.py --reset` deletes every card, profile and todo (ADR-017).
- **Tests:** both suites refuse unmocked network calls, so a test that needs HTTP mocks it (`http_mock` in the backend, a stubbed `fetch` in the frontend).

## Conventions and decisions

- `docs/coding_standards.md` is the authority for conventions, with rule IDs to cite in a review. `.claude/rules/` holds short excerpts of it that load where they apply.
- `docs/adr/` records why the app is the way it is. Read the ADR before changing what it covers; to reverse a decision, write a new ADR that supersedes it rather than editing the old one.

## Boundaries

- **Always:** keep the change to what the task asks; new behaviour arrives with tests (TEST-1); run the checks above.
- **Ask first:** a model or schema change (it needs an Alembic migration), a new dependency, reversing an accepted ADR, adding CI.
- **Never:** push to a remote (the person pushes); read or print `.env` or anything in `secrets/`; edit a migration under `backend/migrations/versions/` that already exists; run `seed.py --reset` or delete `backend/instance/app.db` without being asked (it destroys the user's data); commit secrets.

## Workshop tooling in this repo

- `main` carries no known defects (ADR-018).
- MCP servers are configured in `.mcp.json`: Context7 (documentation) and `random-tools` (a demo server with `coin_flip` and `roll_die`, run by `uv`).
