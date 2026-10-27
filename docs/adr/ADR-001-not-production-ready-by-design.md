# ADR-001: Not Production-Ready by Design

**Date:** March 2026
**Status:** Accepted

### Context

This application is a personal dashboard intended to run locally on a single person's machine. It was built to serve as a demo application for a workshop on prompt engineering and agentic IDE usage. The audience included backend developers, frontend developers, PMs, and other non-technical resources — many of whom had never used a Python framework before. The app needed to be easy to set up, easy to understand, and easy to extend during live demos.

At the same time, the codebase is not intended to be treated as a throwaway or toy application. The expectation is that contributors (both human and AI) write production-quality code — clean, well-structured, and maintainable. The distinction is that while the code quality should be high, the application is intentionally scoped to local execution and does not include features that would only be needed for a deployed, multi-user, internet-facing production environment.

### Decision

The following production features were intentionally omitted:

- **Docker / containerization:** Docker was left out to reduce setup friction. Many workshop attendees may not have Docker installed, and requiring it would add a dependency and a layer of complexity to the onboarding process. The goal was to minimize the number of prerequisites needed to get the app running.
- **Production WSGI server (Gunicorn, uWSGI, etc.):** The app runs on Flask's built-in development server (`app.run(debug=True)` on port 5001). A production WSGI server handles concurrent requests, manages worker processes, and is hardened for internet-facing traffic. Since this app only ever runs locally for a single user, the dev server is entirely appropriate and avoids introducing another tool attendees would need to understand.
- **Authentication and user management:** There is no login, no user model, and no auth middleware. This was a dual-purpose decision — see ADR-011 for full details.
- **CI/CD pipelines:** No GitHub Actions, deployment scripts, or build pipelines exist. The app is run from source in development mode.
- **HTTPS / TLS:** Not needed for localhost-only traffic.

### Consequences

- Setup is fast: clone, install dependencies, seed the database, run two processes.
- The app cannot be deployed to a shared environment without significant additions.
- Contributors must understand that "production-quality code" refers to code structure, clarity, and correctness — not deployment readiness.
- The absence of Docker means environment parity between contributors is not guaranteed (different Python versions, OS-level differences, etc.).
