# Coding Standards

The standards a change in this repo is reviewed against. This document is the
**authoritative source**; it is written to be read on its own, without the rest of
the codebase in context.

Every rule has a stable ID (`API-3`, `TEST-2`). Cite the ID when reporting a
violation so the finding points at a specific rule rather than a general opinion.

**Why this lives in `docs/` and not in the always-on agent context:** these
standards matter at *review* time, not during every edit. Injecting them into
every prompt spends context on rules that are irrelevant to most changes. The
`.claude/rules/` files carry always-on excerpts scoped to the paths they apply
to; where the two ever disagree, **this document wins**.

Scope note: this app is deliberately not production-ready (ADR-001). These
standards govern **code quality** - structure, clarity, correctness - not
deployment readiness. Do not raise findings that amount to "this app is not
production-grade"; that is a decision, not a defect.

---

## 1. General (`GEN`)

- **GEN-1 — Deep modules.** Put substantial behavior behind a small interface. A
  module whose interface is nearly as large as its implementation is not earning
  its keep. (Ousterhout, *A Philosophy of Software Design*.)
- **GEN-2 — Work at one altitude.** A function should not mix high-level
  orchestration with low-level detail. Extract the detail.
- **GEN-3 — Name things for what they mean,** not how they are implemented.
  `fetch` beats `get_json_from_api`.
- **GEN-4 — No dead code.** Do not leave commented-out blocks, unused variables,
  unused imports, or unreferenced parameters behind.
- **GEN-5 — No stray debug output.** No `console.log` / `print` / `debugger` in
  committed code. Use the logger (`LOG-1`) when the output is genuinely wanted.
- **GEN-6 — Comments explain why, not what.** A comment restating the code is
  noise; a comment explaining a non-obvious constraint is valuable.
- **GEN-7 — Do not duplicate a decision.** If a value or rule appears twice, one
  of them will drift. Extract it or point at the other.
- **GEN-8 — Respect the ADRs.** `docs/adr/` records decisions that cannot be
  inferred from the code. A change that contradicts an accepted ADR needs a new
  ADR, not a quiet reversal.

## 2. Flask API routes (`API`)

- **API-1 — No response envelope.** Return data directly and let the HTTP status
  carry success or failure. Never `{"data": ..., "error": null}`.
- **API-2 — Single resource** returns the object: `jsonify(obj.to_dict())`.
- **API-3 — Collection** returns a bare list:
  `jsonify([obj.to_dict() for obj in items])`.
- **API-4 - Error** returns `{"error": "<message>"}` with a matching status code,
  through the app factory's error handlers (`API-10`).
- **API-5 — DELETE** returns an empty body with `204`.
- **API-6 — Status codes** are used as follows:

  | Scenario | Code |
  |----------|------|
  | Success (with body) | 200 |
  | Resource created | 201 |
  | No content (delete) | 204 |
  | Bad request / validation error | 400 |
  | Unauthorized | 401 |
  | Forbidden | 403 |
  | Not found | 404 |
  | Conflict (duplicate) | 409 |
  | Server error | 500 |

- **API-7 — Validate before writing.** Check required fields, types, and
  referenced rows exist, and return `400`/`404` before touching the session.
- **API-8 — Serialize through `to_dict()`.** Routes must not hand-build response
  dicts; the model owns its wire shape.
- **API-9 - Request checks live in `routes/helpers.py`.** A route reads its JSON
  body with `json_object_body()` and loads a row by id with `get_or_404()`
  (which also treats an id beyond SQLite's 64-bit range as not found), and
  checks integers with `is_sqlite_integer()`. Do not re-implement these per
  route module.
- **API-10 - Every error answers JSON.** A route signals a failure with
  `abort(status, message)`; the handlers registered in `app/__init__.py` turn
  every HTTP error (a 404 or 405 included) and every unhandled exception into
  `{"error": ...}`. Never let an HTML error page or a bare traceback out.

```python
# GOOD
@cards_bp.route('/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    card = get_or_404(Card, card_id, 'Card not found')
    db.session.delete(card)
    db.session.commit()
    return '', 204

# BAD - envelope, and a body on delete
return jsonify({'data': None, 'message': 'Deleted'}), 200
```

## 3. Service layer (`SVC`)

Services live in `backend/app/services/<name>.py` and are the only place that
talks to an external API.

- **SVC-1 — Export `fetch`.** Accept config as keyword arguments plus `**_kwargs`,
  so an unrecognized card config can never raise `TypeError`.
- **SVC-2 — Return a flat dict** of the card's data fields. No nesting.
- **SVC-3 — Never raise to the caller.** Wrap every external call in
  `try/except` and return fallback data instead (ADR-009).
- **SVC-4 — Flag the fallback** with `'fallback': True` so the frontend can style
  the degraded state.
- **SVC-5 — Fallback shape matches success shape.** The fallback dict carries the
  *same keys* as a successful response, plus `fallback`. One component renders
  both, so a missing key is a crash.
- **SVC-6 — Always set `timeout=5`** on `requests` calls. An un-timed-out call
  hangs the request thread.
- **SVC-7 — Read config via `current_app.config`,** never `os.environ` directly
  and never a hardcoded key.

## 4. Configuration & secrets (`CFG`)

- **CFG-1 — Secrets are read only in `config.py`,** via
  `os.environ.get('KEY', '<sensible-default>')`.
- **CFG-2 — The app boots with nothing configured.** Every secret has a default
  that degrades gracefully rather than crashing at import.
- **CFG-3 — Never commit a secret.** No keys in source, and `.env` stays
  ignored.
- **CFG-4 — Config classes subclass `Config`.** Add a class rather than
  branching on an environment variable inside the factory.

## 5. Models & migrations (`DB`)

- **DB-1 - Explicit `__tablename__`** on every model, which subclasses the typed
  `Base` in `app/models/base.py` (`DB-11`).
- **DB-2 — Explicit column constraints:** `nullable`, `unique`, `index`,
  `default` are stated, not left implicit.
- **DB-3 — Every model change gets an Alembic migration.** Never rely on
  `create_all()` outside tests.
- **DB-4 — Review the autogenerated migration.** Autogenerate misses renames,
  data migrations, and some constraint changes.
- **DB-5 — Every migration has a working `downgrade()`.**
- **DB-6 — One logical change per migration.**
- **DB-7 — Add a non-nullable column in three steps:** add nullable, backfill,
  then alter to non-nullable.
- **DB-8 — Rename with `op.alter_column(new_column_name=...)`,** never drop-then-add.
- **DB-9 — Reassign JSON columns; never mutate in place.** A plain `JSON` column
  has no mutation tracking, so `card.config['x'] = 1` is silently not persisted.
  Write `card.config = {**card.config, 'x': 1}`.
- **DB-10 — Every model exposes `to_dict()`** returning its API shape, with
  datetimes as ISO-8601 strings that carry their UTC offset (`isoformat_utc`).
- **DB-11 - SQLAlchemy 2.0 style.** Models are `Mapped[...]` columns on `Base`,
  and queries go through `db.session.scalars(db.select(...))` or
  `db.session.get(...)`. Never `Model.query`, which the type checker cannot
  follow (Pyright runs in standard mode and must report 0 errors).
- **DB-12 - Let the database cascade.** A child table declares
  `ForeignKey(..., ondelete='CASCADE')` and the code deletes only the parent.
  This works because the app enforces SQLite foreign keys on every connection;
  migrations switch them off for their batch operations, so do not rely on
  enforcement inside a migration.

## 6. React components (`FE`)

- **FE-1 — Function components with hooks.** No class components.
- **FE-2 — All network access goes through `src/api.js`.** Components never call
  `fetch` directly.
- **FE-3 — Handle all three states** a remote call can be in: loading, error, and
  loaded. A component that only renders the happy path is incomplete.
- **FE-4 — Guard against absent data.** A component that renders `data.foo` must
  handle `data` being null, consistently with its siblings.
- **FE-5 — Complete effect dependencies.** Every value an effect reads is in its
  dependency array; derive a stable key for object dependencies rather than
  omitting them.
- **FE-6 — Clean up on unmount.** Timers, intervals, and subscriptions started in
  an effect are cleared in its cleanup function.
- **FE-7 — Register, don't branch.** New card types are added via the
  `CARD_REGISTRY` in `Card.jsx` and the `SERVICES` dict in `routes/data.py`
  (ADR-008). Never add a `if (source === ...)` chain.
- **FE-8 — Keys are stable identities,** never array indices.
- **FE-9 — Semantic, accessible markup.** Interactive elements are real
  `button`/`a`/`input` with an accessible name; non-obvious controls carry
  `aria-*` or `title`.

## 7. Styling (`CSS`)

- **CSS-1 — Tailwind utilities via `className`** for all static styling.
- **CSS-2 — No per-component CSS/SCSS files,** and no CSS-in-JS libraries
  (styled-components, emotion).
- **CSS-3 — Use Tailwind variants** (`sm:`, `hover:`, `focus:`, `disabled:`)
  rather than hand-written pseudo-class CSS.
- **CSS-4 — Inline `style={{}}` only for runtime values Tailwind cannot express
  statically** - per-card accent custom properties, computed gradients or
  `color-mix(...)`, index-driven `animationDelay`. Never for a static value.
- **CSS-5 — Global CSS lives only in `src/index.css`** - `@theme` tokens,
  keyframes, and `react-grid-layout` overrides. Not per-component styling.
- **CSS-6 — Extract long class lists into a variable,** not into a stylesheet.

## 8. Logging & errors (`LOG`)

- **LOG-1 — `logger = logging.getLogger(__name__)`** per module. No bare `print`.
- **LOG-2 — `logger.exception()` inside an `except`,** so the traceback survives.
- **LOG-3 — Never swallow an exception silently.** A bare `except: pass` is a
  defect; log it, even when returning a fallback.
- **LOG-4 — Never log a secret,** token, or full API key.
- **LOG-5 — User-facing errors are actionable** and do not leak internals.

## 9. Security (`SEC`)

- **SEC-1 — Validate and type-check every request parameter** at the route.
- **SEC-2 — Use the ORM or bound parameters.** No raw SQL built with f-strings or
  `.format()`; `text()` binds via `:param`.
- **SEC-3 — Rely on JSX auto-escaping.** No `dangerouslySetInnerHTML`.
- **SEC-4 — JSON responses are `application/json`,** never `text/html`.
- **SEC-5 — No hardcoded secrets** (see `CFG-3`).
- **SEC-6 — External links carry `rel="noopener noreferrer"`** with
  `target="_blank"`.
- **SEC-7 — Never log or place tokens in URLs.**

> Auth-related checks (protected routes, ownership checks, session handling) are
> **not applicable**: the app has no authentication by deliberate decision
> (ADR-011). Do not raise findings for missing auth.

## 10. Testing (`TEST`)

The suite is the seam that `/implement` and `/tdd` work at, so it is held to the
same standard as the code it covers.

- **TEST-1 — New behavior ships with tests.** A new service, route, model, or
  component is not done until it is covered.
- **TEST-2 — Tests never touch the network.** All external HTTP is mocked -
  `responses` on the backend, a stubbed `fetch` on the frontend. Both suites run
  fully offline; the autouse fixtures fail an unmocked call rather than letting
  it out.
- **TEST-3 — Tests are deterministic.** No dependence on wall-clock time, random
  values, ambient environment variables, or execution order. Reset module-level
  caches between tests.
- **TEST-4 — One behavior per test,** with a name that states that behavior:
  `test_unknown_city_returns_located_fallback`, not `test_weather_2`.
- **TEST-5 — Arrange / act / assert,** separated by blank lines.
- **TEST-6 — Cover the failure path.** Every service needs its graceful-fallback
  path tested (`SVC-3`), and every route its validation and not-found paths.
- **TEST-7 — Assert on behavior, not implementation.** Query the DOM the way a
  user would (roles, labels, text); assert response bodies and status codes, not
  internal call sequences, unless the call *is* the behavior.
- **TEST-8 — Mock at the boundary.** Mock the network or a third-party library
  whose environment the test cannot provide; do not mock the code under test.
- **TEST-9 — Pin known defects rather than deleting the test.** Assert the
  current behavior with a docstring naming it a defect, or mark the desired
  behavior `xfail(strict=True)` so it flips to a failure when fixed. This
  applies to a defect on a `defect/<exercise>` branch; `main` carries no known
  defects (ADR-018), so a defect found on `main` is fixed there with a test that
  fails without the fix, not pinned.
- **TEST-10 - Both suites, the linters and the type check must be green before
  commit.** Backend `pytest`, `ruff check .` (from `backend/`) and `pyright` (from
  the repo root); frontend `npm run test:run` and `npm run lint` (from
  `frontend/`). `npm run test:e2e` runs the Playwright suite against the real
  app. See README for the setup.
- **TEST-11 — Test each half of a compound condition.** For a guard like
  `if (a || !b) return`, a test where `a` and `!b` are both true proves neither
  clause is load-bearing: either one can be deleted and the suite stays green.
  Give each clause a case where it alone does the work. This applies to the
  fallback operators too - `??` and `||` differ only on `0` and `''`.
- **TEST-12 — Fixtures must span the boundary being tested.** A test that runs
  the line but cannot distinguish correct from incorrect is not coverage. If
  the code has a zero-vs-falsy branch, the fixture needs a zero; if it has a
  length cap, the fixture needs a value on each side of it. A fallback branch
  must be asserted via a marker the success branch cannot produce, or deleting
  the branch will not fail anything.

```python
# GOOD - one behavior, named for it, failure path covered
# (backend/tests/test_services_weather.py)
def test_unknown_city_returns_located_fallback(self, http_mock):
    register_geocode(http_mock, [])

    result = weather.fetch(city='Nowhereville')

    assert result['fallback'] is True
    assert result['description'] == 'Could not find location: Nowhereville'
    assert result['city'] == 'Nowhereville'
    assert result['temp'] == '--'
```

---

## Reviewing against this document

Work the sections that the diff actually touches. For each finding, give the
rule ID, the file and line, and the concrete consequence. If a change violates a
rule for a good reason, say so and propose the ADR rather than silently allowing
it.

Refactoring findings should name the smell they are pointing at - long method,
large class, feature envy, primitive obsession, shotgun surgery, divergent
change (Fowler, *Refactoring*) - so the suggestion lands as shared vocabulary
rather than personal taste.
