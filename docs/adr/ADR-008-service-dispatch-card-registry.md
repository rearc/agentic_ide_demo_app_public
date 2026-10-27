# ADR-008: Service Dispatch and Card Registry Pattern

**Date:** March 2026
**Status:** Accepted

### Context

The dashboard displays multiple types of cards (weather, quotes, space imagery, todos, placeholder), each with different data sources and UI components. The architecture needed a way to add new card types without modifying core routing or layout logic.

### Decision

A dual-registry pattern was implemented:

- **Backend:** A `SERVICES` dictionary in `backend/app/routes/data.py` maps source name strings to handler functions. The `/api/data/<source>` route looks up the source in this dictionary and calls the corresponding function, passing query parameters as keyword arguments. Adding a new data source means writing a `fetch(**kwargs)` function and adding one line to the dictionary.
- **Frontend:** A `CARD_REGISTRY` object in `frontend/src/components/Card.jsx` maps source names to React components and their configuration (whether they need data, their accent color). Adding a new card UI means creating a component file and adding one entry to the registry.

This pattern was designed from the beginning of the project. It was not something that emerged organically — it was mapped out with the help of an agentic IDE based on the goal of making the application easily extensible. The fact that the extensibility pattern was itself AI-assisted is relevant context, given that this app is a teaching exhibit for agentic IDE workflows.

### Consequences

- Adding a new card type is a well-defined, repeatable process (documented in AGENTS.md as a 5-step guide).
- Unknown sources fall back gracefully — the backend returns a 404, and the frontend renders a placeholder widget.
- The pattern is easy to understand: one dictionary lookup on each side.
- There is a loose coupling between backend sources and frontend components via the source name string — if these drift out of sync, the failure mode is a placeholder card rather than a crash.
