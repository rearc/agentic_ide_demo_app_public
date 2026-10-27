# ADR-010: No Automated Tests

**Date:** March 2026
**Status:** Superseded by ADR-016

> Superseded by [ADR-016](ADR-016-test-seam-for-agentic-workflows.md) (July 2026),
> which adds a pytest + vitest suite and `docs/coding_standards.md`. The context
> below remains an accurate record of why tests were originally absent.

### Context

The application has no automated tests — no pytest for the backend, no Jest for the frontend, no test files of any kind. No testing framework is included in the project's dependencies.

### Decision

Tests were purposely left out of the codebase. Originally, this was a simplicity decision consistent with the project's overall philosophy of minimizing complexity. Additionally, during early planning, adding tests to this application was considered as a potential live demo during the workshop — showing attendees how to use an agentic IDE to implement test-driven development.

That plan changed, and the absence of tests in this codebase came to be acknowledged as a gap rather than a deliberate ongoing architectural choice.

### Consequences

- No automated verification that the API routes, services, or frontend components behave correctly.
- Refactoring carries more risk without a test safety net.
- The absence of tests is a known gap, not a statement that tests are unnecessary.
- Adding a test suite (pytest for backend, Jest/Vitest for frontend) would be a valuable future contribution.
