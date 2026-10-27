# ADR-014: Destructive Seed Script

**Date:** March 2026
**Status:** Superseded by ADR-017

> Superseded by [ADR-017](ADR-017-additive-seed-with-explicit-reset.md)
> (July 2026), which makes the default seed additive and moves the destructive
> behavior behind `--reset` - the upsert-based improvement this ADR anticipated.
> The context below remains an accurate record of how the destructive seed
> came about.

### Context

The application needs a way to populate the database with initial card data for development and workshop use. The seed script (`backend/seed.py`) is the mechanism for this.

### Decision

The seed script deletes all existing cards and todos before inserting fresh seed data. This "delete everything and rebuild" approach was implemented due to time constraints — it reached a minimum viable state and development moved on to other priorities. It is not a deliberate architectural choice but rather a pragmatic shortcut that has persisted.

### Consequences

- Running `python seed.py` is a destructive operation that wipes all user-created data (custom cards, todos, layout arrangements).
- This is fine for workshop use where reproducibility matters — every attendee gets the same starting state.
- It is problematic for the "personal dashboard" use case where someone has customized their cards and layout over time. Running the seed script would destroy their customizations.
- A future improvement would be an upsert-based seed that only adds missing default cards without destroying existing data.
