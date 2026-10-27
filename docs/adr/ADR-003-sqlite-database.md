# ADR-003: SQLite as the Database

**Date:** March 2026
**Status:** Accepted

### Context

The application needs a relational database to store cards, todos, and their relationships. The most common options for a Python/Flask application are PostgreSQL, MySQL, and SQLite. PostgreSQL and MySQL are full client-server databases that require installation, configuration, and a running daemon process. SQLite is a file-based database that requires zero installation — it ships with Python's standard library.

During the workshop, attendees needed to be able to set up and run the application with as little friction as possible. Any additional dependency that required installation, configuration, or troubleshooting was a risk to the demo flow.

### Decision

SQLite was chosen as the database (`sqlite:///app.db`). It requires no installation, no running daemon, and no configuration. The database is a single file that can be deleted and re-created in seconds by re-running the seed script. This made debugging and rebuilding the data layer extremely trivial during development and workshop demos.

SQLite's known limitations — single-writer concurrency, no network access, limited JSON querying — are irrelevant for a single-user, locally-running application.

### Consequences

- Zero database setup: `flask db upgrade` and `python seed.py` create everything from scratch.
- The database file can be blown away and re-seeded in seconds, which is valuable for workshop reproducibility.
- Attendees do not need PostgreSQL, MySQL, or any database tooling installed.
- Migration scripts use Alembic's batch mode for SQLite compatibility (SQLite doesn't support all ALTER TABLE operations natively).
- If the app were ever deployed as a multi-user service, SQLite would need to be replaced with a client-server database.
