import { useState } from 'react'

import { GRADIENT_TEXT_CLASS } from './gradientText'

/** Minimal °C / °F segmented toggle — shows the widget isn't static. */
function UnitToggle({ unit, setUnit }) {
  return (
    <div className="inline-flex items-center rounded-sm border border-border-subtle overflow-hidden text-[10px] font-bold">
      {['C', 'F'].map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          className={`px-1.5 py-0.5 transition-colors ${
            unit === u
              ? 'bg-surface-hover text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          °{u}
        </button>
      ))}
    </div>
  )
}

export default function WeatherCard({ data }) {
  const [unit, setUnit] = useState('F')

  if (!data) return null

  if (data.fallback) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <p className="text-4xl mb-2">🌤️</p>
        <p className="text-sm text-text-muted">{data.description}</p>
      </div>
    )
  }

  // Open-Meteo returns Celsius; convert to Fahrenheit client-side for the toggle.
  const temp =
    unit === 'C' ? Math.round(data.temp) : Math.round((data.temp * 9) / 5 + 32)

  return (
    <div className="h-full flex flex-col justify-center gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-5xl font-extrabold tracking-tight leading-[1.15] pr-1 ${GRADIENT_TEXT_CLASS}`}
          >
            {temp}°
          </p>
          <p className="text-sm text-text-secondary capitalize mt-2">
            {data.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {data.icon_emoji && (
            <span className="text-5xl leading-none drop-shadow-lg">
              {data.icon_emoji}
            </span>
          )}
          <UnitToggle unit={unit} setUnit={setUnit} />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="font-semibold text-text-secondary">{data.city}</span>
        {data.humidity != null && <span>💧 {data.humidity}% humidity</span>}
      </div>
    </div>
  )
}
