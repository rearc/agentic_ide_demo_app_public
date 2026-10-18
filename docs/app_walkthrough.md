# App Walkthrough — a guided tour of the Dashboard

> **What this is:** a presenter's script for explaining this app out loud while
> opening the files it names, in order. It is a *human* tour of the codebase, not
> agent instructions (that's `AGENTS.md`). Follow it top to bottom and the room
> will understand the whole app — backend, frontend, and database — in about ten
> minutes.

---

## Step 0 — Before you present (setup)

Do this **off-stage, before the room is watching** — the first thing they should see is the app already running, not a terminal.

1. **Follow the setup in [README.md](../README.md)** — backend venv with an explicit **Python 3.11+** interpreter + `pip install`, and frontend deps (`nvm use` → Node 22, then `npm install`).
2. **Seed the database:** `cd backend && python seed.py`: the **Default** profile should start with the **five seeded cards** (Weather · Daily Quote · Coming Soon · Space Photo · Todos).
3. **Run both servers** in two terminals:
   - Backend: `cd backend && python run.py` → `http://127.0.0.1:5001`
   - Frontend: `cd frontend && npm run dev` → `http://localhost:5173`
4. **Open `http://localhost:5173`** and leave it on screen.

Now begin the tour **on the running app** — deliver "The point of the app" below with the live dashboard up, pointing at the real cards, before you open a single file.

---

## The point of the app

*(Present this with the app open in the browser — point at the cards as you talk.)*

It's a **personal dashboard you run locally and make your own** — a "control
center." The board holds **cards**: some pull live data (weather, a daily quote,
NASA's photo of the day), some are self-contained tools (a todo list), and one is
an empty **"Coming Soon"** slot inviting the next one.

The app is deliberately **small and conventional** — a Flask API, a React SPA, a
SQLite file. That's the whole point: the interesting part isn't the framework, it's
that **adding a feature here is a fixed, repeatable pattern** (see [The punchline](#the-punchline-adding-a-feature--adding-a-card)),
which is exactly what makes it a good codebase to extend live with an agent.

## Architecture at a glance

> Show the diagram here: **[architecture.drawio.png](architecture.drawio.png)** - the picture of the tiers below, with the file path on every box, the two registries joined by the `source` string highlighted, `api.js` as the only place that calls `fetch`, and the todo cascade. Editable source: [architecture.drawio](architecture.drawio).

```
  Browser (localhost:5173)
      │  React SPA — one page, a grid of cards
      ▼
  Vite dev server ──proxy /api──►  Flask API (127.0.0.1:5001)
                                      │
                    ┌─────────────────┼───────────────────┐
          ┌─────────┬─────────┴────────┬─────────────────┐
          ▼         ▼                  ▼                 ▼
   /api/cards  /api/profiles   /api/data/<source>   /api/todos
  (the library) (named boards) (live data per source) (todo items)
          │         │                  │                 │
          ▼         ▼                  ▼                 ▼
     SQLite (app.db) via SQLAlchemy  external APIs   SQLite (app.db)
                                    (Open-Meteo, NASA…) via SQLAlchemy
```

Two things to hold in your head:
1. **A card record** (title, icon, source, config) lives in the database, and every card is in the **library**. **Where** a card sits is not on the card: a **profile** (a named board) holds each card's place.
2. **A card's live data** is fetched separately, on demand, by *source*.

---

## The one flow that explains everything

Walk this end-to-end once; it touches every layer. *"How does the Weather card get on screen?"*

1. **Browser loads the SPA.** [frontend/src/main.jsx](../frontend/src/main.jsx) mounts [App.jsx](../frontend/src/App.jsx), which renders the header and [Dashboard.jsx](../frontend/src/components/Dashboard.jsx).
2. **The app asks for the cards and the profiles.** `useBoard()` ([frontend/src/useBoard.js](../frontend/src/useBoard.js)) calls `fetchCards()` and `fetchProfiles()` in [frontend/src/api.js](../frontend/src/api.js) → `GET /api/cards` and `GET /api/profiles`.
3. **Vite proxies `/api` to Flask.** See the proxy in [frontend/vite.config.js](../frontend/vite.config.js) (→ `127.0.0.1:5001`).
4. **Flask returns the card records.** [backend/app/routes/cards.py](../backend/app/routes/cards.py) `list_cards()` reads every card from SQLite (`db.session.scalars(db.select(Card)...)`), ordered by `position`.
5. **Dashboard lays them out.** `App` hands it the cards and the shown profile's board; it builds a grid from each visible board entry (`x`, `y`, `w`, `h`) and renders one [Card.jsx](../frontend/src/components/Card.jsx) per card on the board.
6. **Each Card picks its component.** `Card.jsx` looks up `card.source` in the **`CARD_REGISTRY`** to find which React component to render and whether it `needsData`.
7. **Data cards fetch their data.** For Weather, `Card.jsx` calls `fetchCardData('weather', config)` → `GET /api/data/weather`.
8. **Flask dispatches by source.** [backend/app/routes/data.py](../backend/app/routes/data.py) looks up `'weather'` in its **`SERVICES`** map (an unknown source answers a JSON 404) and calls [backend/app/services/weather.py](../backend/app/services/weather.py), which calls the Open-Meteo API and returns clean JSON (with a graceful fallback if the API is down).
9. **The card renders.** [frontend/src/components/cards/WeatherCard.jsx](../frontend/src/components/cards/WeatherCard.jsx) turns that JSON into the widget you see.

That's the app. Everything below is just the detail of each stop.

---

## Frontend (open these in order)

- **[frontend/src/main.jsx](../frontend/src/main.jsx)** — the entry point. Mounts `<App />`. One line to notice: `import './index.css'`.
- **[frontend/src/App.jsx](../frontend/src/App.jsx)** - the shell: branded header (the animated Rearc AI Labs lockup, the profile menu, the Edit board / Done button, while editing a Library toggle, and a live clock), the library drawer and `<Dashboard/>`. Note `App` owns one `mode` state (`view`, `library` or `arrange`): it opens the drawer and passes `locked` down, and takes everything else from `useBoard()`. The clock is its own `Clock` component, so its one-second tick re-renders only the clock, not the grid.
- **[frontend/src/components/Dashboard.jsx](../frontend/src/components/Dashboard.jsx)** - renders the cards and board it is handed as a **draggable/resizable grid** (`react-grid-layout`); it fetches nothing. When you unlock and finish a drag, a resize, a removal (the × on each card while editing) or a drop from the library, it calls `saveLayout`, `hideCard` or `showCard` from `useBoard`, which PATCH the profile's board back to the API, which is why your arrangement persists. How cards make room for one that moves, grows or is dropped (sideways where the row has room, otherwise down) is in [frontend/src/boardLayout.js](../frontend/src/boardLayout.js).
- **[frontend/src/useBoard.js](../frontend/src/useBoard.js)** - the one owner of board state: the card library, the profiles, and which profile is shown (remembered per browser in `localStorage`). Its writes are optimistic and sent to the server one at a time, each replacing the whole board; a failed write reloads the profiles so the screen returns to what was saved.
- **Profiles and the library** - [ProfileMenu.jsx](../frontend/src/components/ProfileMenu.jsx), [EditButton.jsx](../frontend/src/components/EditButton.jsx), [LibraryButton.jsx](../frontend/src/components/LibraryButton.jsx) and [LibraryDrawer.jsx](../frontend/src/components/LibraryDrawer.jsx). The header reads "Control Center / <profile>"; the name is a menu to switch profiles, save the shown board as a new one, rename or delete (never the last). Edit board unlocks the cards and opens a drawer of every card, with search: Add a card, or drag it onto the grid, where it lands on the spot you drop it and the cards it covers move down. The Library button folds the drawer away while you keep editing, so the board sits exactly where it will when viewed and cards can be sized against the real screen. Done locks the board and closes the drawer. A removed card is only hidden on that profile, so it comes back at its last size and its todos survive.
- **[frontend/src/components/Card.jsx](../frontend/src/components/Card.jsx)** - the heart of the frontend. The **`CARD_REGISTRY`** (top of the file) maps a `source` string → `{ component, accent, needsData }`. The generic `Card` wrapper handles the chrome (title, icon, the card's colour, a Live or Fallback status, `LoadingDots`, error), and only fetches data when `needsData` is true. A card whose `source` has no registry entry renders `UnregisteredCard`, which names the missing source, so registry drift is visible. A card whose component throws while drawing says so in its own body (`CardErrorBoundary`), so one broken card never blanks the board. **This registry is the extension point.**
- **[frontend/src/components/cards/](../frontend/src/components/cards/)** — one component per card type. Open **WeatherCard.jsx** as the example (note the client-side °C/°F toggle — a widget with real state). Contrast with **PlaceholderCard.jsx** (pure static) and **TodoCard.jsx** (its own CRUD against `/api/todos`).
- **[frontend/src/api.js](../frontend/src/api.js)** - the entire backend contract in one small file, and the only place that calls `fetch`: `fetchCards`, the profile calls (`fetchProfiles`, `createProfile`, `updateProfile`, `deleteProfile`), `fetchCardData`, and the todo calls, all going through one `request()` helper that turns the API's `{"error": ...}` body into the thrown message. Good place to show *"the frontend only knows these endpoints."*
- **[frontend/src/index.css](../frontend/src/index.css)** — design tokens in Tailwind's `@theme`: surface and text colours, a named palette (`--color-rally-*`), and one `--color-card-*` token per card that points at a palette colour. That token is how each card gets its colour.

**The key frontend idea — three kinds of cards.** All are just one entry in `CARD_REGISTRY`; they differ only in *where their data lives*:
- **Data card** (`needsData: true`) — fetches live data from `/api/data/<source>` through a backend service. Owns no table. *(weather, quote, space, daylight, iss: the ISS card gets the station's orbit data and its browser works out the position every second, on a d3 globe loaded only when the card is shown)*
- **Static card** (`needsData: false`) — fixed or purely client-side content, no backend at all. *(placeholder; timer, a countdown with a Pomodoro mode; moon, the phase worked out from the date)*
- **Stateful card** (`needsData: false`) — owns **persisted data** via its own model, routes, and table, so it needs a **migration**. It talks to its own endpoint, not `/api/data`. *(todo)*

That last distinction is the whole cost story of adding a card: static is cheapest, a data card adds one service, and only a **stateful** card pays for a database migration (see [the punchline](#the-punchline-adding-a-feature--adding-a-card)).

---

## Backend (open these in order)

- **[backend/run.py](../backend/run.py)** — starts the dev server on **port 5001**. Tiny; it just builds the app and runs it.
- **[backend/app/__init__.py](../backend/app/__init__.py)** - the **app factory**. Creates the Flask app, wires SQLAlchemy + Migrate + CORS, and registers four blueprints (cards, data, profiles, todos) all under `/api`. It also turns SQLite foreign keys on for every connection, and registers the error handlers that answer every error, even a 404 or an unhandled exception, as `{"error": ...}` JSON. This is the map of the backend.
- **[backend/config.py](../backend/config.py)** — configuration: the SQLite URL (`app.db`) and env-driven secrets (loads the repo-root `.env`).
- **[backend/app/routes/cards.py](../backend/app/routes/cards.py)** - CRUD for card *records* (`/api/cards`). Note `list_cards` returns every card, ordered by `position`; a card carries no layout, so a new card is on no board until added. One `FIELD_RULES` table says what each card field must hold, and create and update both check against it.
- **[backend/app/routes/profiles.py](../backend/app/routes/profiles.py)** - `/api/profiles`: list, create, `PATCH` (rename and/or replace the whole `board`), delete. A board is an object keyed by card id, `{"3": {"x": 0, "y": 0, "w": 4, "h": 4, "hidden": false}}`; an unknown card id is a 400, a duplicate name a 409, and the last profile cannot be deleted (409).
- **[backend/app/routes/helpers.py](../backend/app/routes/helpers.py)** - the request checks every route module shares: `json_object_body()` (the body must be a JSON object), `get_or_404()` and `is_sqlite_integer()`. Each bad request calls `abort`, and the app factory's handlers turn it into the JSON error.
- **[backend/app/routes/data.py](../backend/app/routes/data.py)** — the **`SERVICES` dispatch table**. `GET /api/data/<source>` looks up `<source>` and calls its handler. Adding a data source = adding one line here. (This is the backend twin of the frontend's `CARD_REGISTRY`.)
- **[backend/app/services/weather.py](../backend/app/services/weather.py)** — a representative **service**: call an external API, return a flat dict, and **always** return a fallback dict on failure so a dead API never breaks the UI. `quotes.py`, `space.py` and `daylight.py` follow the same shape; `weather.py` and `daylight.py` share the city lookup in `open_meteo.py`.
- **[backend/app/routes/todos.py](../backend/app/routes/todos.py)** - a fuller CRUD example (the todo card is stateful), showing validation and status codes. Todos belong only to cards whose `source` is `todo`; any other card id answers 404.

**The key backend idea:** two registries mirror each other — **`CARD_REGISTRY`** (frontend: how to render a source) and **`SERVICES`** (backend: how to fetch a source).

---

## Database layer

- **[backend/app/models/base.py](../backend/app/models/base.py)** - the typed `Base` every model subclasses (instead of `db.Model`), so Pyright can check the models. Queries use `db.session.scalars(db.select(...))`, never `Model.query`.
- **[backend/app/models/card.py](../backend/app/models/card.py)** - the `Card` model. Point out `config` is a **JSON column** (flexible per-card settings), that the card has no position on the grid (ADR-019), and that `to_dict()` is exactly what the API returns.
- **[backend/app/models/profile.py](../backend/app/models/profile.py)** and **[profile_card.py](../backend/app/models/profile_card.py)** - a `Profile` is a named board; each `ProfileCard` row is one card's `x`, `y`, `w`, `h` and `hidden` on it, keyed by profile and card, with both foreign keys `ON DELETE CASCADE`, so the database removes a board entry when its card or profile goes (ADR-019).
- **[backend/app/models/todo.py](../backend/app/models/todo.py)** - the `Todo` model, with a foreign key to `cards` (`ON DELETE CASCADE`) - deleting the todo card removes its items. That works because the app factory turns SQLite foreign keys on (SQLite has them off by default); migrations run with them off.
- **[backend/migrations/versions/](../backend/migrations/versions/)** - the schema's history as **Alembic migrations**: initial cards table → add `layout` column → add todos table → move card layouts into profiles (drops `layout` and `is_active`). Schema changes go through here, never `create_all()`.
- **[backend/seed.py](../backend/seed.py)** - inserts any of the starting cards that are missing, and creates the **Default** profile from `DEFAULT_BOARD` when there is no profile. Additive and safe to re-run: cards, todos, profiles and board changes are preserved, and a missing default card goes back on Default only (ADR-017, ADR-019). ⚠️ `python seed.py --reset` is the destructive path: it wipes the `cards`, `profiles` and `todos` tables first, so anything added at runtime is lost.

---

## The punchline: adding a feature = adding a card

Every card touches the **same predictable set of files**. This is the whole reason
the app exists in this shape — the extension surface is identical every time, which
is what makes it safe and fast to extend with an agent.

| # | File | What you add |
|---|------|--------------|
| 1 | `backend/app/services/{slug}.py` | a `fetch()` that returns the card's data |
| 2 | `backend/app/routes/data.py` | one line in `SERVICES` |
| 3 | `frontend/src/components/cards/{Name}Card.jsx` | the display component |
| 4 | `frontend/src/components/Card.jsx` | one line in `CARD_REGISTRY` |
| 5 | `frontend/src/index.css` | a card colour token, pointing at a palette colour |
| 6 | `backend/seed.py` | a seed row, and its place in `DEFAULT_BOARD` so it appears on the Default board (every card is in the library regardless) |
| 7 | *(only if stateful)* an Alembic migration | a new table/column |

Steps 1–2 are **backend-only** and only needed for *data* cards; a self-contained
card (like a timer or calculator) skips them and just does 3–6. This 7-touchpoint
pattern is codified in the **`add-dashboard-card` skill**
([.claude/skills/add-dashboard-card/SKILL.md](../.claude/skills/add-dashboard-card/SKILL.md)) —
that's what an agent follows to build a card end-to-end.

---

## Presenter notes (say these if asked)

- **Ports:** frontend `5173`, backend `5001`. The frontend proxies `/api` to the backend, so the browser only ever talks to `5173`.
- **Two-kinds-of-cards** is the mental model that makes everything click — lead with it.
- **`seed.py` is safe to re-run mid-demo**: it only adds missing default cards. It is `seed.py --reset` that wipes the cards, profiles and todos, so don't reach for that flag if you've added cards you want to keep.
- **Graceful fallbacks:** every data service returns a fallback on failure, so a flaky conference network degrades a card instead of breaking the page.
- **Where to start a live "add a card":** the empty **Coming Soon** card is the invitation — pick a new widget and walk the 7 touchpoints above.
