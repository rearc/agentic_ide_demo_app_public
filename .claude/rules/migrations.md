---
paths:
  - "backend/{app/models,migrations}/**"
---

# SQLAlchemy & Alembic Migration Best Practices

## Model Changes

- Always create an Alembic migration after changing a SQLAlchemy model. Never rely on `create_all()` in production.
- Use explicit column types and constraints (`nullable`, `unique`, `index`, `server_default`).
- Add `__tablename__` explicitly on every model.

## Writing Migrations

- Auto-generate first, then review: `flask db migrate -m "descriptive message"`.
- Always inspect the generated migration — auto-detect misses renames, data migrations, and some constraint changes.
- Every migration must have a working `downgrade()`. Test both directions.
- Keep migrations small and focused — one logical change per migration file.

## Data Safety

- Never drop columns or tables without confirming the data is no longer needed.
- For column renames, use `op.alter_column()` with explicit `new_column_name` — do not drop + add.
- Add new non-nullable columns in two steps: add as nullable, backfill, then alter to non-nullable.
- Wrap data migrations in explicit transactions when operating outside Alembic's default transaction.

## Commands Reference

```bash
flask db migrate -m "add widgets table"   # generate
flask db upgrade                          # apply
flask db downgrade                        # rollback one
flask db history                          # view chain
```
