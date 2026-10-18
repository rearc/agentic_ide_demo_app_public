import {
  CloudFogIcon,
  CloudIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudSunIcon,
  ListChecksIcon,
  MoonIcon,
  PlanetIcon,
  QuestionIcon,
  QuotesIcon,
  SunIcon,
  ThermometerIcon,
  TimerIcon,
} from '@phosphor-icons/react'

/**
 * The icon names data may use, each mapped to a Phosphor icon.
 *
 * A card's `icon` field holds one of these names (at most 10 characters, the
 * column's size), and so does the weather service's condition icon
 * (`WEATHER_CODE_ICONS` in backend/app/services/weather.py). To use a new
 * icon, add its name here first.
 */
export const ICONS = {
  // Card icons
  'cloud-sun': CloudSunIcon,
  quote: QuotesIcon,
  planet: PlanetIcon,
  checklist: ListChecksIcon,
  timer: TimerIcon,
  moon: MoonIcon,
  // Weather conditions
  sun: SunIcon,
  cloud: CloudIcon,
  fog: CloudFogIcon,
  rain: CloudRainIcon,
  snow: CloudSnowIcon,
  storm: CloudLightningIcon,
  thermometer: ThermometerIcon,
  question: QuestionIcon,
}

/** The named icon, decorative; nothing for an empty or unknown name. */
export default function Icon({ name, size = 18, className = '', style }) {
  const Glyph = ICONS[name]
  if (!Glyph) return null
  return (
    <Glyph
      size={size}
      className={className}
      style={style}
      aria-hidden
      data-icon={name}
    />
  )
}
