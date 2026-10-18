# ADR-018: A Clean `main`, with Teaching Defects on Branches

**Date:** October 2026
**Status:** Accepted

### Context

This app is a teaching exhibit (ADR-001), and the workshop built on it uses
defects as material: a test to flip from failing to passing, a bug to reproduce
with curl, a fallback that hides a failure, a test that breaks when a card is
added. Until now those defects lived on `main`, next to the code people read to
learn the app's conventions.

That arrangement had three costs:

- **The base taught the wrong thing.** An attendee or an agent reading `main`
  to learn "how things are done here" also read the defects, and an agent
  extending the app copies what it finds.
- **Defects were pinned rather than designed.** ADR-016 recorded two of them
  (deleting a card left its todos behind; `create_card` ignored a supplied
  `layout`) as strict `xfail` tests. They were whatever happened to be wrong,
  not the defect that best fits each exercise.
- **One exercise's defect was every other exercise's noise.** A demo that adds
  a card tripped over a seed test that asserted exactly five cards, whether or
  not that demo was about tests.

`docs/DEMO_BRANCHING.md` already treats `main` as the clean starting state and
runs each demo on a throwaway branch cut from it.

### Decision

- **`main` holds no known defects.** A defect found on `main` is fixed there,
  with a test that would fail without the fix.
- **A defect an exercise needs is planted on purpose, on a branch** cut from
  `main`, chosen for that exercise, and written down where the exercise's
  material lives: what was planted, where, and how to tell it is fixed.
  `docs/DEMO_BRANCHING.md` describes where those branches live.
- **The two defects ADR-016 pinned are fixed on `main`.** SQLite foreign keys
  are turned on for every connection, so the declared `ON DELETE CASCADE`
  removes a card's todos; `POST /api/cards` stores a supplied `layout`. Their
  `xfail` tests are now ordinary tests. ADR-016's account of them is accurate
  history of the suite as it was when that ADR was written, as ADR-010's account
  of the missing tests is.

### Consequences

- Reading `main` shows the conventions without exceptions to explain away; an
  agent copying what it finds copies working code.
- Each exercise gets a defect shaped for what it teaches, and an exercise that
  is not about a defect does not meet one.
- Planted defects need upkeep: when `main` moves, each defect branch is rebased
  or replanted, and its write-up kept current. That cost is accepted.
- The suite has no `xfail` tests on `main`; a strict `xfail` is now something a
  defect branch adds, not something `main` carries.
- ADR-016 stands: the suite and its purpose are unchanged. Only its consequence
  describing the two pinned defects is history.
