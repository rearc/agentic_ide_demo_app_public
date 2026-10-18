import { GRADIENT_TEXT_CLASS } from './gradientText'

export default function PlaceholderCard() {
  return (
    <div
      className="h-full flex flex-col items-center justify-center text-center rounded-sm border border-dashed p-6"
      style={{ borderColor: 'color-mix(in oklab, var(--a) 45%, transparent)' }}
    >
      <p className="text-4xl mb-3 animate-subtle-pulse">✨</p>
      <p
        className={`text-base font-bold ${GRADIENT_TEXT_CLASS}`}
      >
        What should we build here?
      </p>
      <p className="text-text-muted text-xs mt-2">
        Pick a widget and we&apos;ll add it live
      </p>
    </div>
  )
}
