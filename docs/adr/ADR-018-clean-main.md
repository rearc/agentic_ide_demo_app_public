# ADR-018: A Clean `main`

**Date:** October 2026
**Status:** Accepted

### Context

This app is a teaching exhibit (ADR-001): people and agents read `main` to learn
how things are done here, and an agent extending the app copies what it finds.
Until now `main` also carried known defects, next to the code it was meant to
teach by.

That arrangement had two costs:

- **The base taught the wrong thing.** Reading `main` to learn the conventions
  meant reading the exceptions too.
- **Defects were pinned rather than fixed.** ADR-016 recorded two of them
  (deleting a card left its todos behind; `create_card` ignored a supplied
  `layout`) as strict `xfail` tests, and a seed test that asserted exactly five
  cards broke whenever a card was added.

### Decision

- **`main` holds no known defects.** A defect found on `main` is fixed there,
  with a test that would fail without the fix.
- **The two defects ADR-016 pinned are fixed on `main`.** SQLite foreign keys
  are turned on for every connection, so the declared `ON DELETE CASCADE`
  removes a card's todos; `POST /api/cards` stores a supplied `layout`. Their
  `xfail` tests are now ordinary tests. ADR-016's account of them is accurate
  history of the suite as it was when that ADR was written, as ADR-010's account
  of the missing tests is.

### Consequences

- Reading `main` shows the conventions without exceptions to explain away; an
  agent copying what it finds copies working code.
- The suite has no `xfail` tests on `main`.
- ADR-016 stands: the suite and its purpose are unchanged. Only its consequence
  describing the two pinned defects is history.
