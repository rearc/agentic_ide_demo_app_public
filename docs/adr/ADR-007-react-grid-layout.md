# ADR-007: react-grid-layout for the Dashboard Grid

**Date:** March 2026
**Status:** Accepted

### Context

The dashboard's core interaction model is a grid of cards that users can drag, reposition, and resize. This requires a layout engine that handles collision detection, responsive breakpoints, and smooth drag-and-drop animations. Building this from scratch with CSS Grid and custom drag logic would be a significant engineering effort.

### Decision

The `react-grid-layout` library (v2.2.3) was chosen to provide the draggable, resizable grid. It was the first library evaluated that worked well enough for the use case. The choice was pragmatic rather than the result of an extensive comparison of alternatives.

The grid layout serves a purpose beyond functionality — it makes the app feel like a customizable platform rather than a static webpage. The locked/unlocked toggle signals to users that this is something they can make their own. The long-term vision is that someone takes this dashboard and "vibe codes" a collection of extremely personalized utilities, adding cards over time and arranging them to suit their daily workflow. The grid layout is what makes that vision tangible.

### Consequences

- The dashboard feels interactive and customizable out of the box.
- Layout state (x, y, width, height) is persisted per card via the API, so arrangements survive page reloads.
- The library is a dependency that could be replaced if a more performant or feature-rich alternative emerges — there is no strong commitment to this specific package.
- The lock/unlock UX pattern adds a small amount of complexity to the Dashboard component but keeps the default experience clean (locked = no accidental drags).
