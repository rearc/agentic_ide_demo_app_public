# ADR-002: Flask Over Django

**Date:** March 2026
**Status:** Accepted

### Context

The backend needed a Python web framework to serve a REST API for the dashboard. The two most common choices in the Python ecosystem are Flask and Django. Django provides a rich feature set out of the box — an admin panel, a built-in ORM with migration tooling, authentication middleware, form handling, and an opinionated project structure. Flask, by contrast, is a microframework that provides routing, request handling, and a plugin ecosystem, but leaves most architectural decisions to the developer.

The workshop audience spanned a wide range of technical backgrounds: backend developers, frontend developers, PMs, and other non-technical resources. Many attendees had never used a Python web framework before. The framework choice needed to optimize for readability and approachability above all else.

### Decision

Flask was chosen as the backend framework. Django's conventions — URL conf modules, settings files, middleware stacks, the admin autodiscovery system — require significant upfront learning before a newcomer can understand how a request flows through the application. Flask's simplicity means that a route handler is just a decorated function that receives a request and returns a response. Someone reading the code for the first time can follow the logic without needing to learn framework-specific patterns.

We acknowledge that Django would provide a richer feature set (particularly its admin panel and built-in auth), but those features are not needed for this application's scope, and the complexity they introduce would work against the goal of making the codebase approachable. Migration to Django is not desired at this time.

### Consequences

- Backend code is immediately readable to someone who has never used Flask or Django.
- The plugin ecosystem (Flask-SQLAlchemy, Flask-Migrate, Flask-CORS) provides what's needed without Django's overhead.
- There is no admin panel for managing data — the seed script and API endpoints serve that purpose.
- If the application's scope grew significantly (e.g., multi-user with roles and permissions), the lack of Django's built-in features would become a real cost.
