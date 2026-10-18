# Weather card: where each file lives

The weather card is the fullest data card in the app: a service with config, a second API call, a cache, a component with its own UI state, and tests for each. Read the live files rather than a copy, so the example never drifts from the code. This map says where each piece is and what to take from it.

| Stage | File | What to take from it |
|---|---|---|
| 1 Service | `backend/app/services/weather.py` | `fetch(city='San Francisco', **_kwargs)`: a config param with a default. `GEOCODE_URL` and `FORECAST_URL` as module constants. A `_fallback()` helper that returns the success keys plus `'fallback': True`. `@lru_cache` on the geocoding lookup (the tests reset it between runs). |
| 2 Route | `backend/app/routes/data.py` | The import line and the `'weather': weather.fetch` entry in `SERVICES`. Query-string params such as `?city=Paris` reach `fetch` as keyword args. |
| 3 Config | none | Open-Meteo needs no key. For a keyed API, follow `backend/app/services/space.py` (`NASA_API_KEY` via `current_app.config`) and `backend/config.py`. |
| 4 Component | `frontend/src/components/cards/WeatherCard.jsx` | The fallback branch first, then the data. `useState` for the °C/°F toggle: state the card owns, which most cards don't need. |
| 5 Registry | `frontend/src/components/Card.jsx` | The `weather` entry in `CARD_REGISTRY`: `component`, `accent: 'card-weather'`, `needsData: true`. |
| 6 Accent | `frontend/src/index.css` | `--color-card-weather` and `--color-card-weather-2` in the `@theme static` block. |
| 7 Seed | `backend/seed.py` | The `Card(slug='weather', ...)` row: `config={'city': 'San Francisco'}`, `layout={'x': 0, 'y': 0, 'w': 4, 'h': 4}`, `position=1`. |
| 8 Tests | `backend/tests/test_services_weather.py`, `frontend/src/components/cards/WeatherCard.test.jsx` | Success and fallback paths with the network mocked (`http_mock` on the backend), and the component asserted by what a user sees. `test_services_quotes.py` and `QuoteCard.test.jsx` are the simpler starting point. |

For a **stateful** card (its own table), the reference is the todo card instead: `backend/app/models/todo.py`, `backend/app/routes/todos.py` (with the request checks in `backend/app/routes/helpers.py`), its Alembic migration in `backend/migrations/versions/`, `frontend/src/components/cards/TodoCard.jsx`, and `backend/tests/test_routes_todos.py`.
