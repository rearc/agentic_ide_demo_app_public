---
name: flask-api-conventions
description: Backend conventions for this Flask API — service-layer shape, data-route wiring, config/secrets access, and error handling. Background knowledge Claude applies when working in the backend.
when_to_use: "Applied automatically when reading or editing Python files under backend/ (services, routes, config, models)."
user-invocable: false
paths: backend/**
---

# Flask API conventions

Reference knowledge for the backend. This is **not** a command — it loads automatically when work touches `backend/**` so generated code matches the existing patterns. `docs/coding_standards.md` holds the full rule set with IDs (`SVC-*`, `API-*`); response shapes and status codes are in the `api-conventions` rule.

## Service layer (`backend/app/services/<name>.py`)

- Export a function named `fetch` that accepts config params as keyword args plus `**_kwargs`.
- Return a **flat dict** (no nested objects) with the card's data fields.
- Wrap every external call in `try/except`; on failure return a fallback dict with `'fallback': True` and the **same keys** as the success response.
- Use `requests` with `timeout=5` for HTTP.
- Log with `logging.getLogger(__name__)` and `logger.exception()` on error.

## Data-route wiring (`backend/app/routes/data.py`)

- Register a service by importing it and adding an entry to the `SERVICES` dict.
- The `SERVICES` key must exactly match the `source` value on the card record.

## Config & secrets (`backend/config.py`)

- Read secrets via `os.environ.get('KEY', '<sensible-default>')` in the `Config` class — the app must still boot when a key is unset.
- In a service, reach config with `from flask import current_app` then `current_app.config.get('KEY')`.
- Keep keys out of the code and read them only in `config.py`: `.env` is gitignored so real keys never reach the repo, and `TestConfig` pins known values so the tests stay deterministic.

## Models and migrations

- Only a **stateful** card (its own model + table) needs a model change and an Alembic migration; data and static cards do not. The `todo` feature is the reference implementation.
- How to write the migration is in the path-scoped rule `.claude/rules/migrations.md`, which loads when you touch `backend/app/models/` or `backend/migrations/`.

## Python baseline

- Target **3.11+** (the app uses `datetime.UTC`).
