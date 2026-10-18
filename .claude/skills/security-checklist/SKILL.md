---
name: security-checklist
description: Security checklist for changes to this Flask + React app - request validation, queries, rendering, secrets and logging, each with the reason it matters here. Use when reviewing a diff or pull request for security, or before committing a change to a route, service, model or component.
---

# Security checklist

Check a change against these items. `docs/coding_standards.md` holds the rules with their IDs (`SEC-*`, `CFG-*`, `LOG-*`); cite the ID in a finding. Report only what applies to the change in front of you.

## What applies to this app

- **Every request parameter is validated and type-checked at the route** (`SEC-1`). The routes write straight to SQLite, so a missing check becomes bad data or a 500; `backend/app/routes/todos.py` (`_validate_text`) shows the pattern.
- **Queries go through the SQLAlchemy ORM or bound parameters** (`SEC-2`). A raw SQL string built with an f-string or `.format()` is an injection point; `text()` must bind values with `:param`.
- **React renders text through JSX** (`SEC-3`). JSX escapes what it renders; `dangerouslySetInnerHTML` switches that off, and the cards display text from third-party APIs (quotes, NASA descriptions).
- **API responses are JSON** (`SEC-4`): return `jsonify(...)` or a dict, never HTML, so a browser never renders a response as a page.
- **Secrets stay in `.env` and are read only in `backend/config.py`** (`CFG-1`, `CFG-3`). `.env` is gitignored; a key anywhere else ends up in git history.
- **External links that open a new tab carry `rel="noopener noreferrer"`** (`SEC-6`), so the opened page cannot reach back into the dashboard.
- **Tokens and keys are never logged or put in URLs** (`LOG-4`, `SEC-7`). Logs and URLs are copied into tickets, chats and browser history.

## Known and accepted for local development

- `CORS(app)` in `backend/app/__init__.py` allows every origin, and `backend/run.py` starts Flask with `debug=True`. Both are fine for a local workshop app. Flag them only when a change moves the app toward a shared or deployed environment.

## Not applicable

- Authentication and authorization: the app has none by decision (ADR-011). Do not report missing auth.
- File uploads: the app has none.

## Output

For each finding: the rule ID, the file and line, what could go wrong in this app, and the fix. If nothing applies, say so in one line.
