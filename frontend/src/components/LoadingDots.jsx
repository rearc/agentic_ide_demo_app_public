const DOT_SIZE_CLASS = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2' }

/** Three pulsing dots announced to screen readers as `label`. */
export default function LoadingDots({ label, size = 'sm', className = '' }) {
  return (
    <div
      className={`flex justify-center ${className}`}
      role="status"
      aria-label={label}
    >
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${DOT_SIZE_CLASS[size]} rounded-full bg-text-muted animate-subtle-pulse`}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}
