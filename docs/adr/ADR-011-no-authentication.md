# ADR-011: No Authentication or User Management

**Date:** March 2026
**Status:** Accepted

### Context

The application is a personal dashboard designed to run locally on a single person's machine. There is no deployment target, no multi-user scenario, and no shared access. Additionally, the workshop focuses on agentic IDE workflows, and adding authentication end-to-end (backend middleware, user model, login UI, session management) is exactly the kind of ambitious, cross-cutting task that would make a compelling live demo of AI-assisted development.

### Decision

Authentication was intentionally omitted: it solves a problem that doesn't exist here. This is a locally-running, single-user application. There is no scenario where multiple people need to log in to the same instance. Implementing auth would add complexity with zero functional benefit for the intended use case.


### Consequences

- The app has no concept of users, sessions, or permissions.
- Any card or todo can be created, modified, or deleted by anyone with access to the API.
- This is a non-issue for local-only usage but would be a blocker for any shared deployment.
