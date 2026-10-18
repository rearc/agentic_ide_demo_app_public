/**
 * Classes that paint text with the card's accent gradient (--a to --b, set by
 * Card). Tailwind classes rather than an inline style or a global rule: the
 * value is static (CSS-4) and global CSS is for tokens and keyframes (CSS-5).
 */
export const GRADIENT_TEXT_CLASS =
  'bg-[linear-gradient(135deg,var(--a),var(--b))] bg-clip-text text-transparent'
