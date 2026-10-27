# ADR-017: Additive Seed with an Explicit Reset

**Date:** July 2026
**Status:** Accepted (supersedes ADR-014)

### Context

ADR-014 recorded that `backend/seed.py` deleted every card and todo before
inserting fresh seed data. It was explicit that this was not a designed choice:
it "reached a minimum viable state and development moved on," and the ADR named
the fix it wanted - "an upsert-based seed that only adds missing default cards
without destroying existing data."

The cost landed on the use case the app is nominally built around. This is a
personal dashboard: someone drags their cards into an arrangement they like,
writes todos, and adds a card of their own. Running `python seed.py` threw all of
it away. Worse, the seed script is the documented way to make a newly added
default card appear, so the workflow for *adding* a card required destroying the
user's data as a side effect.

Two things did depend on the destructive behavior and had to survive:

- **Workshop reproducibility.** Every attendee needs the same starting board, and
  a presenter needs to get back to it between runs.
- **Demo restore.** Re-seeding is part of returning a demo run to a clean
  starting state.

Both of those want "restore the pristine state" *on purpose*. Neither wants it as
the silent default of the only command that installs a new card.

### Decision

Split the two intentions apart and make the safe one the default.

- **`python seed.py` is additive.** It inserts only the default cards whose slug
  is not already present, and deletes nothing. Custom cards, todos, dragged
  layouts, renamed titles, and deactivated cards all survive. It is idempotent:
  running it twice changes nothing the second time.
- **`python seed.py --reset` is the destructive path.** It wipes `cards` and
  `todos` first and restores the pristine default board. This is what workshop
  reset and demo restore now call, and it says what it does at the call site.
- **Existing rows are never overwritten.** A default card that is already present
  is left exactly as the user has it, rather than being reset to its seed values.
  Matching is by `slug`, the same key the frontend registry and backend dispatch
  already agree on (ADR-008).
- **The starter todo is written only alongside a newly created todo card,** so a
  user who clears their todo list does not find it silently reappear.
- **`seed()` takes an optional app.** It previously built its own, which made it
  impossible to point at a test database. The default is unchanged.

### Consequences

- The dashboard behaves like the personal dashboard it claims to be: a re-seed is
  no longer a data-loss event.
- Adding a new default card is now a safe, additive operation. The
  `add-dashboard-card` workflow's final "re-seed" step inserts just the new card.
- Reproducibility is preserved but must be asked for by name. Anyone who relied
  on bare `seed.py` to reset will need `--reset`; the docs and the
  `add-dashboard-card` skill have been updated accordingly.
- The seeder now has two paths rather than one, which is more surface to keep
  working. Both are covered by tests, including the specific data-loss cases this
  ADR exists to prevent.
- A default card the user has edited will drift from its seed definition, and a
  re-seed will not pull it back. That is the intended trade: the user's copy wins.
  `--reset` is the escape hatch.
- ADR-014 is superseded. Its account of how the destructive seed came to exist
  remains accurate history.
