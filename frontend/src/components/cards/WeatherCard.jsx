import { useState } from 'react'

import Icon from '../Icon'

/** °C / °F segmented toggle: the widget is not static. */
function UnitToggle({ unit, setUnit }) {
  return (
    <div className="inline-flex shrink-0 border border-hairline-strong">
      {['C', 'F'].map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => setUnit(u)}
          className={`min-h-8 min-w-10 px-2 text-[13px] font-medium transition-colors ${
            unit === u
              ? 'bg-text-primary text-surface'
              : 'text-text-secondary hover:text-text-primary'
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
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
        <Icon name={data.icon} size={32} className="text-text-secondary" />
        <p className="text-sm text-text-secondary">{data.description}</p>
      </div>
    )
  }

  // Open-Meteo returns Celsius; convert to Fahrenheit client-side for the toggle.
  const temp =
    unit === 'C' ? Math.round(data.temp) : Math.round((data.temp * 9) / 5 + 32)

  return (
    <div className="h-full flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-6xl font-light leading-none tracking-tight tabular-nums">
          {temp}°
        </p>
        <UnitToggle unit={unit} setUnit={setUnit} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] first-letter:uppercase">
            {data.description}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-[13px] text-text-secondary">
            <span>{data.city}</span>
            {data.humidity != null && (
              <span>
                Humidity{' '}
                <span className="font-mono text-text-primary">
                  {data.humidity}%
                </span>
              </span>
            )}
          </p>
        </div>
        <Icon name={data.icon} size={44} className="shrink-0" />
      </div>
    </div>
  )
}
