# ADR-012: Latest Dependency Versions Across the Stack

**Date:** March 2026
**Status:** Accepted

### Context

When initializing the project, decisions had to be made about which versions of each dependency to use. Some projects pin to older, battle-tested versions for stability. Others use the latest releases to benefit from current features, performance improvements, and security patches.

### Decision

The project uses the latest stable versions of all dependencies at the time of creation: Flask 3.1.1, React 18.3.1, Vite 6.4.1, Tailwind CSS v4.2.2, SQLAlchemy (via Flask-SQLAlchemy 3.1.1), and so on. This was a general principle applied across the entire stack rather than a per-dependency evaluation.

This means the project uses Tailwind CSS v4's new CSS-native configuration approach (with `@theme` tokens in `index.css` and the `@tailwindcss/vite` plugin) rather than v3's `tailwind.config.js` + PostCSS setup. It also means using SQLAlchemy 2.0+ style with `mapped_column` and `Mapped` types rather than the older declarative syntax.

### Consequences

- The codebase reflects current best practices and modern API surfaces for each library.
- Workshop attendees see contemporary patterns they can apply to new projects.
- Documentation and Stack Overflow answers for the latest versions may be less abundant than for older, more established versions.
- Future dependency updates should be less painful since the project starts from a recent baseline.
