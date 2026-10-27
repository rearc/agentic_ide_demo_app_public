# ADR-006: SPA + API Separation Over Monolith

**Date:** March 2026
**Status:** Accepted

### Context

There were two viable approaches for structuring the application:

1. **Monolith with server-rendered templates:** Flask serves HTML via Jinja2 templates. Everything runs as a single process. This is simpler to set up and deploy but limits frontend interactivity — each user action that needs new data requires a full page refresh (or a separate JavaScript layer bolted onto the templates).
2. **SPA + REST API:** A React single-page application communicates with a Flask API backend. The frontend and backend are separate processes connected via HTTP. This requires more setup but enables rich client-side interactivity.

The dashboard's core UX involves dragging and resizing cards in a grid layout, inline editing of todos, live data fetching with loading states, and optimistic UI updates. These interactions are fundamentally client-side-driven.

### Decision

The application uses a separated architecture: a React SPA (port 5173) communicating with a Flask REST API (port 5001), connected via Vite's development proxy. This decision was driven by two factors:

1. **Demonstrating the SPA + API pattern:** The workshop is about modern development practices, and this separation is the dominant pattern in contemporary web development. Having a clean API layer separate from the frontend is a valuable teaching exhibit.
2. **Avoiding the complexity of state management in server-rendered templates:** The dashboard's interactivity — drag-and-drop grid layout, inline todo editing, optimistic updates, per-card loading states — would be significantly harder to implement with Jinja2 templates. You'd end up writing substantial custom JavaScript anyway, but without React's state management and component model. Server-side rendering would mean fighting the framework to achieve the UX the app requires.

### Consequences

- The frontend and backend are cleanly separated, each with its own concerns.
- Rich client-side interactivity is natural to implement with React's state management.
- Development requires two terminal processes (Vite + Flask), which adds setup complexity.
- The Vite dev proxy (`/api` -> `http://127.0.0.1:5001`) bridges the two during development.
- The pattern is immediately recognizable to developers familiar with modern web architecture.
