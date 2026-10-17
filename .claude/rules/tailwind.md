---
paths:
  - "frontend/**/*.{jsx,tsx}"
---

# Tailwind CSS Only

All styling in React components must use Tailwind CSS utility classes. No other styling approaches are permitted.

## Rules

- Use Tailwind utility classes directly on elements via `className`.
- Never use inline `style={{}}` attributes.
- Never create or import custom CSS/SCSS files for component styling.
- Never use CSS-in-JS libraries (styled-components, emotion, etc.).
- Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) for breakpoints.
- Use Tailwind's state variants (`hover:`, `focus:`, `disabled:`) instead of custom pseudo-class CSS.
- When multiple classes get long, extract them into a variable or use `clsx`/`cn` for conditional composition — not into a CSS file.

## Examples

```jsx
// GOOD
<button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
  Save
</button>

// BAD — inline style
<button style={{ backgroundColor: 'blue', color: 'white' }}>Save</button>

// BAD — custom CSS class
<button className="save-button">Save</button>
```
