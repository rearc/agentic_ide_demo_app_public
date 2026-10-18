---
name: add-dashboard-card
description: Step-by-step workflow for adding a new dashboard card to this Flask + React app, covering backend service, route wiring, frontend component, card registry, accent color, database seeding, and tests.
when_to_use: "Use when the user wants to add a new card, widget, or tile to the dashboard, or wire a new data source into the app."
argument-hint: "[slug] [source]"
arguments: [slug, source]
effort: high
---

# Add a Dashboard Card

This skill walks through adding a new card type to this dashboard app. Work through the stages in order — each has a verification step so you catch problems early. `docs/coding_standards.md` is the authority for the rules cited here by ID (`SVC-1`, `FE-4`, `TEST-2`).

## Arguments (if invoked with them)

If this skill was invoked with arguments, use `$slug` as the card slug and `$source` as its data source, and skip the matching questions in **Before you start**. Full argument text: $ARGUMENTS. If no arguments were passed, gather the details below as normal.

See `references/weather-card-example.md` for where each file of an existing card lives and what to copy from it.

## Card archetypes — decide this first

Every card is **one row in the `cards` table + one entry in `CARD_REGISTRY`**. Cards differ only in *where their data comes from*, and that decides how much backend work you do:

| Archetype | `needsData` | Data source | Extra backend work |
|-----------|-------------|-------------|--------------------|
| **Data card** (weather, quote, space) | `true` | live fetch from `/api/data/<source>` via a backend service | Stages 1–2 (+3 if the API needs a key) |
| **Static card** (placeholder; a client-only timer, calculator, clock) | `false` | none — rendered entirely in the component | none (skip stages 1–3) |
| **Stateful card** (todo) | `false` | its **own** model, routes, and table — it talks to its own endpoint, **not** `/api/data` | a new SQLAlchemy model + routes blueprint + **an Alembic migration** (skip stages 1–3) |

**All three** still do the frontend, seed and test stages (4 component, 5 `CARD_REGISTRY`, 6 accent color, 7 seed row, 8 tests). The difference is only what happens on the backend.

Cost, cheapest → most work: **static → data → stateful.** Only a **stateful** card requires a **database migration** — that's the difficulty cliff, so prefer static or data cards unless the widget genuinely must persist its own data. The built-in `todo` card is the reference implementation of the stateful pattern (see `backend/app/models/todo.py`, `backend/app/routes/todos.py`, and its migration).

## Before you start

Gather these from the user:

1. **Card name** — a short slug (lowercase, no spaces) like `weather`, `news`, `stocks`
2. **Data source** — what API or data does the card display?
3. **Config params** — does the card need user-configurable values? (e.g., `city` for weather)
4. **API key** — does the external API require a key? If so, it goes in `.env` and `backend/config.py`

## Stage 1: Backend Service

**Create** `backend/app/services/{slug}.py`

Rules (`SVC-1` to `SVC-7`):
- Export a function called `fetch` that accepts config params as keyword args plus `**_kwargs`
- Return a flat dict (no nested objects) with the card's data fields
- Wrap all external API calls in try/except; on failure return a fallback dict with `'fallback': True` and the same keys as the success response
- Use `requests` with `timeout=5` for HTTP calls
- Put the API URL in a module-level constant, so the tests in Stage 8 can mock exactly that URL
- Use `logging.getLogger(__name__)` and `logger.exception()` for errors
- If an API key is needed, read it via `from flask import current_app` then `current_app.config.get('YOUR_KEY')`

```python
import logging
import requests

logger = logging.getLogger(__name__)

EXAMPLE_URL = 'https://api.example.com/data'

def fetch(param='default', **_kwargs):
    try:
        resp = requests.get(EXAMPLE_URL, params={'q': param}, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        return {
            'field_a': data['a'],
            'field_b': data['b'],
        }
    except Exception:
        logger.exception('Failed to fetch data')
        return {
            'fallback': True,
            'field_a': '',
            'field_b': 'Data unavailable',
        }
```

**Verify:** `cd backend && python -c "from app.services import {slug}; print({slug})"` — should import without error.

## Stage 2: Wire the Service into the Data Route

**Edit** `backend/app/routes/data.py`

1. Add an import: `from app.services import {slug}`
2. Add an entry to the `SERVICES` dict: `'{slug}': {slug}.fetch,`

The key in `SERVICES` must exactly match the `source` value you will use in the database card record.

**Verify:** Start the backend (`cd backend && python run.py`) and hit `http://127.0.0.1:5001/api/data/{slug}` — should return JSON.

## Stage 3: API Key (if needed)

If the external API requires a key:

1. **Add to `.env`:** `YOUR_API_KEY=the-key-value`
2. **Add to `backend/config.py`** in the `Config` class: `YOUR_API_KEY = os.environ.get('YOUR_API_KEY', '')`
3. **Read in the service** via `current_app.config.get('YOUR_API_KEY')` with a sensible fallback

Skip this stage if the API is free/keyless.

## Stage 4: Frontend Component

**Create** `frontend/src/components/cards/{PascalName}Card.jsx`

Rules:
- Default export a function component that receives `{ data, card }` props
- Return `null` when there is no data yet (`FE-4`), then handle `data.fallback` — render a fallback message
- Use Tailwind classes from the project theme: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-xs`, `text-sm`, etc.
- The parent `Card.jsx` handles data fetching, loading, and error states. Most cards need no local state (`QuoteCard`, `SpaceCard`); add `useState` only for UI the card owns, as `WeatherCard` does for its °C/°F toggle
- Keep it simple: render the data fields from your service

```jsx
export default function ExampleCard({ data }) {
  if (!data) return null

  if (data.fallback) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-text-muted">{data.field_b}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold text-text-primary">{data.field_a}</p>
      <p className="text-sm text-text-secondary">{data.field_b}</p>
    </div>
  )
}
```

## Stage 5: Register the Card

**Edit** `frontend/src/components/Card.jsx`

1. Add an import at the top with the other card imports:
   ```javascript
   import {PascalName}Card from './cards/{PascalName}Card'
   ```

2. Add an entry to `CARD_REGISTRY`:
   ```javascript
   {slug}: { component: {PascalName}Card, accent: 'card-{slug}', needsData: true },
   ```

   Set `needsData: false` only if the card renders static content with no backend data fetch.

## Stage 6: Add the Accent Color

**Edit** `frontend/src/index.css`

Add the card's color variables inside the `@theme static { }` block, alongside the existing card colors:

```css
--color-card-{slug}: #hexvalue;
--color-card-{slug}-2: #hexvalue;   /* optional second accent for the card's gradients */
```

`Card.jsx` reads both: the first is the card's accent, the second blends with it in the header bar and glow (it falls back to the first when absent). `static` keeps Tailwind from dropping variables that are only used through `var()`.

Pick a color that is visually distinct from the existing ones:
- weather: `#fbbf24` (amber), second `#fb7185`
- quote: `#f472b6` (pink), second `#a78bfa`
- space: `#22d3ee` (cyan), second `#6366f1`
- placeholder: `#818cf8` (indigo), second `#22d3ee`
- todo: `#34d399` (emerald), second `#22d3ee`

Good options for new cards: red (`#ef4444`), violet (`#8b5cf6`), lime (`#84cc16`), sky (`#0ea5e9`), orange (`#fb923c`).

## Stage 7: Seed the Card into the Database

**Edit** `backend/seed.py`

Add a new `Card(...)` entry to the `cards` list:

```python
Card(
    slug='{slug}',
    title='{Title}',
    description='{Short description}',
    icon='{emoji}',
    source='{slug}',
    config={'param': 'default_value'},  # only if your service takes params; omit otherwise
    layout={'x': ?, 'y': ?, 'w': 4, 'h': 4},
    position={next_number},
),
```

Layout notes:
- Grid is 12 columns wide. The default cards are `w: 4` (a third); use `w: 6` for half width or `w: 12` for full width.
- `h: 4` is a good default height. Image-heavy cards (like space) use `h: 6`.
- Position cards to avoid overlaps: check existing `x, y` values.

Then seed the new card: `cd backend && python seed.py`

`seed.py` is **additive** (per the demo app's ADR-017): it inserts only the cards that are
missing and leaves existing cards and their data untouched, so it is safe to run against a
board you care about. Use `python seed.py --reset` **only** when you deliberately want to
wipe and rebuild the whole board.

**Verify:** `curl http://127.0.0.1:5001/api/cards` — your new card should appear in the list.

## Stage 8: Tests

New behavior ships with tests (`TEST-1`), and tests never touch the network (`TEST-2`): both suites block any unmocked call.

**Backend:** create `backend/tests/test_services_{slug}.py`, following `test_services_quotes.py`. Use the `http_mock` fixture (the `responses` library) to register the service's URL constant, and cover both paths (`TEST-6`):
- the success response, with the exact fields the service returns;
- the fallback when the upstream fails (for example `status=500`): `'fallback': True` and the same keys as success (`SVC-5`).

**Frontend:** create `frontend/src/components/cards/{PascalName}Card.test.jsx`, following `QuoteCard.test.jsx`. Render the component with Testing Library and assert what a user sees (`TEST-7`): the data fields, the fallback message, and nothing rendered when `data` is null.

**Verify:** `cd backend && pytest tests/test_services_{slug}.py` and `cd frontend && npm run test:run -- {PascalName}Card` both pass, then the full suites (`pytest`, `npm run test:run`) stay green (`TEST-10`).

## Stage 9: End-to-End Verification

1. Backend is running: `cd backend && python run.py`
2. Frontend is running: `cd frontend && npm run dev`
3. Open `http://localhost:5173` in a browser
4. Confirm the new card appears in the grid with:
   - Correct title, icon, and description in the header
   - Data loaded from your service (not a loading spinner or error)
   - Accent color in the top bar, and the glow on hover
5. Unlock the layout and drag the card — confirm it saves position

## Quick Checklist

| # | File | Action |
|---|------|--------|
| 1 | `backend/app/services/{slug}.py` | Create service with `fetch()` |
| 2 | `backend/app/routes/data.py` | Import service, add to `SERVICES` dict |
| 3 | `.env` + `backend/config.py` | Add API key (if needed) |
| 4 | `frontend/src/components/cards/{PascalName}Card.jsx` | Create display component |
| 5 | `frontend/src/components/Card.jsx` | Import component, add to `CARD_REGISTRY` |
| 6 | `frontend/src/index.css` | Add `--color-card-{slug}` (and `-2`) in `@theme static` |
| 7 | `backend/seed.py` | Add `Card(...)` entry, run `python seed.py` (additive insert) |
| 8 | `backend/tests/test_services_{slug}.py` + `frontend/src/components/cards/{PascalName}Card.test.jsx` | Success and fallback paths, network mocked |
