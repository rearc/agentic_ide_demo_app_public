---
paths:
  - "frontend/src/**/*.jsx"
---

# Tailwind CSS first

Style React components with Tailwind utility classes in `className`. One styling system keeps components consistent, and a reviewer can see a component's whole look in its markup.

## Rules

- Put static styling in `className`: layout, spacing, colour, typography, borders, plus Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) and state variants (`hover:`, `focus:`, `disabled:`).
- Use `style={{}}` only for values Tailwind cannot know at build time: a card's accent passed in as CSS variables (`--a`, `--b`), a gradient or `color-mix()` built from those variables, or a computed value such as a staggered `animationDelay`.
- Take colours from the `--color-card-*` tokens in `frontend/src/index.css` rather than writing hex values in components, so a card's accent changes in one place.
- Keep keyframes, global utility classes and third-party overrides (react-grid-layout) in `frontend/src/index.css`. Components do not import CSS files of their own, and the app uses no CSS-in-JS library.
- When a class list gets long, move it into a variable in the component rather than into a CSS class.

## Examples

```jsx
// GOOD: static styling as utilities
<button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Save
</button>

// GOOD: an inline style for a value computed at runtime
<div className="animate-card-enter" style={{ animationDelay: `${i * 0.2}s` }} />

// BAD: a static value as an inline style (use className="block shrink-0")
<svg style={{ display: 'block', flexShrink: 0 }} />

// BAD: a custom CSS class for component styling
<button className="save-button">Save</button>
```
