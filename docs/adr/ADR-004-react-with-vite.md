# ADR-004: React with Vite for the Frontend

**Date:** March 2026
**Status:** Accepted

### Context

The dashboard frontend needed to support rich interactivity: draggable and resizable card widgets, live data fetching, inline editing, optimistic UI updates, and a component-based architecture that makes adding new card types straightforward. The framework choice also needed to consider that some workshop attendees might never have seen a modern frontend framework before.

### Decision

React 18 was chosen as the frontend framework for several reasons:

1. **Rich ecosystem:** React's package ecosystem made it easy to add features like the draggable grid layout (`react-grid-layout`). The breadth of available libraries meant that "fun" and visually impressive cards could be added quickly.
2. **State management:** React's built-in hooks (`useState`, `useEffect`, `useCallback`) provide clean state management that the dashboard's interactivity demands — tracking card data, layout changes, todo editing state, loading states, and error states.
3. **Extensibility:** The card registry pattern (mapping source names to React components) means adding a new card type is as simple as creating a new component file and adding one line to the registry. This supports the long-term vision of the app as a platform people can "vibe code" new utilities into.
4. **Readability:** React's JSX syntax is relatively approachable for newcomers. A component is a function that returns markup — the mental model is straightforward.
5. **Exposure:** For attendees who hadn't seen React before, this app provides a simple, non-overwhelming introduction. A side effect might be that they realize they could use React in their own projects.

Vite was chosen as the build tool because it is the modern default for new React projects. This was a recommendation from the AI assistant during initial project setup, and there was no strong reason to choose an alternative like Create React App (which is effectively deprecated) or Next.js (which adds server-side rendering complexity that isn't needed here).

### Consequences

- The frontend is component-based and easy to extend with new card types.
- Hot module reloading via Vite provides a fast development feedback loop.
- Two processes must be running during development (Vite dev server + Flask), which adds slight setup complexity compared to a monolithic approach.
- Attendees without React experience get exposure to it in a simple context.
- The app is tied to the React ecosystem for its frontend.
