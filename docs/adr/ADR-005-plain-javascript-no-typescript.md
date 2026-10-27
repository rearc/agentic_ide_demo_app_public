# ADR-005: Plain JavaScript, No TypeScript

**Date:** March 2026
**Status:** Accepted

### Context

TypeScript has become the default choice for many React projects, providing static type checking, better IDE autocomplete, and compile-time error detection. However, it also adds complexity: type annotations throughout the code, generic syntax, interface definitions, and occasional type gymnastics that can obscure the underlying logic.

The workshop audience included people who had potentially never seen React before. Introducing both React's component model and TypeScript's type system simultaneously would increase the cognitive load for newcomers.

### Decision

The entire frontend is written in plain JavaScript (`.jsx` files) with no TypeScript. This was a deliberate choice to keep the codebase as readable as possible. JSX is already a new syntax for people unfamiliar with React — layering TypeScript's `.tsx` syntax, type annotations, and generics on top of that would detract from the readability of the code.

The approach is consistent with the broader philosophy of the project: introduce one concept at a time. Attendees see JSX first; if they pursue React further, they can adopt TypeScript in their own projects when they're ready.

### Consequences

- Frontend code is more readable for newcomers — there's less syntax to parse in each file.
- No compile-time type checking means certain categories of bugs (wrong prop types, missing fields) won't be caught until runtime.
- IDE autocomplete is less precise without type definitions.
- If the project grows in complexity, the lack of TypeScript could make refactoring harder. This is an acceptable tradeoff for the current scope.
