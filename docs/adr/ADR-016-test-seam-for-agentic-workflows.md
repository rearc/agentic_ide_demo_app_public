# ADR-016: A Test Seam for Agentic Workflows

**Date:** July 2026
**Status:** Accepted (supersedes ADR-010)

### Context

ADR-010 recorded that this codebase had no automated tests. It described the
absence as acknowledged debt rather than a principle: tests had originally been
left out for simplicity, and the gap was simply never closed. It explicitly noted that adding a test
suite "would be a valuable future contribution."

Two things then made that gap load-bearing rather than merely untidy.

**Agents need something to verify against.** An agent that writes code needs a
suite to run as it works and a standards document to review a change against. With
neither, test-driven work has nowhere to go, and a review has no citable standard.
An agent working unattended has nothing to verify its own work against, which
undercuts the argument that autonomy is safe once the controls exist.

**The suite is itself a teaching artifact.** Agents extending this app read the
existing tests and write new ones in their image. That makes the suite's idiom -
naming, structure, what a fallback path looks like when tested - as consequential
as its coverage. A thin token suite would teach a thin token habit.

There was also a live risk to manage. Three services call external APIs
(Open-Meteo, ZenQuotes, NASA APOD). A suite that reached the network would fail
in a room full of attendees sharing a connection and a rate limit - during the
exact demo it exists to support.

### Decision

Add a real test suite and a coding standards document.

- **Backend:** pytest over the app factory, with an in-memory SQLite `TestConfig`
  and per-test schema creation. Covers the three services on both their happy and
  graceful-fallback paths, the `/api/cards`, `/api/data/<source>` and `/api/todos`
  routes, and the `Card` and `Todo` models. Test-only dependencies live in
  `backend/requirements-dev.txt` so the runtime dependency list stays honest.
- **Frontend:** vitest with @testing-library/react and jsdom. Covers `api.js`,
  the `Card.jsx` registry dispatch, `Dashboard.jsx`'s lock state and debounced
  layout save, and all five card components.
- **Determinism is a hard requirement.** Autouse fixtures in both suites fail any
  HTTP request a test did not explicitly register, so neither suite can reach the
  network, and both are safe to run offline and in parallel with a live demo.
- **`create_app()` takes an optional config object.** This is the structural
  change the suite required: the factory previously hardcoded `config.Config`, so
  there was no way to point it at a test database. The default is unchanged, so
  `run.py`, `seed.py`, and the Alembic environment are unaffected. The other
  production edits made alongside it are defect fixes the new tests justified: a
  stray `console.log`, an unused parameter, and two missing null guards.
- **`docs/coding_standards.md` is the authoritative standards document.** It
  consolidates the four `.claude/rules/` files into one self-contained, reviewable
  document with stable rule IDs, and adds testing standards. The rules files keep
  their bodies - they are working exhibits of the always-on rules primitive - but
  each now names the standards doc as the source of truth. Standards live outside
  the always-on agent context deliberately: they matter at review time, and
  injecting them into every prompt spends context on rules irrelevant to most
  edits.

**This does not make the application production-ready, and is not an attempt to.**
ADR-001 stands unchanged: no Docker, no production WSGI server, no CI/CD, no
HTTPS, no auth. Those omissions are deliberate and remain so. ADR-001 already drew
the line this ADR sits on - "production-quality code" means structure, clarity,
and correctness, not deployment readiness - and a test suite is squarely on the
code-quality side of it. The suite exists to give the agentic workflow a seam to
work at, not to prepare the app for deployment.

### Consequences

- Test-driven work has a real harness, and a review can cite the standards
  document's rule IDs.
- An agent working unattended can prove its own work with a single command per
  side, and the branch it produces can be judged on whether the suite still passes.
- Refactoring is safer, and the registry patterns in ADR-008 now have executable
  documentation: adding a card type means copying an existing service test and
  adding a dispatch case.
- Contributors must keep two suites green, and new behavior is expected to arrive
  with tests (`TEST-1`). This is a real ongoing cost, accepted deliberately.
- The suites are a maintenance surface of their own. Because they mock at the
  network boundary, a change to a service's external contract will not be caught
  by them - that risk is accepted in exchange for determinism.
- Some tests deliberately pin behavior that is wrong rather than right. Deleting a
  card does not delete its todos, because SQLite ships with foreign keys disabled
  and the app never enables them; `create_card` silently ignores a supplied
  `layout`. These are asserted as-is, with an `xfail(strict=True)` stating the
  desired behavior, so they surface as known defects instead of being invisible.
- ADR-010 is superseded. Its account of *why* tests were originally absent remains
  accurate history.
