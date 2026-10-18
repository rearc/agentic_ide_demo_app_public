import { useEffect, useId, useMemo, useState } from 'react'
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js'
import { feature } from 'topojson-client'
import land110m from 'world-atlas/land-110m.json'

// The globe is drawn in a SIZE by SIZE box that scales with the card.
const SIZE = 300
const LAND = feature(land110m, land110m.objects.land)
const GRATICULE = geoGraticule10()
const SPHERE = { type: 'Sphere' }
// One orbit takes about 92 minutes; the path shows half of it either side.
const ORBIT_HALF_MINUTES = 46
const DRAG_DEGREES_PER_PIXEL = 0.4
const KEY_STEP_DEGREES = 10
const MAX_TILT = 70

/**
 * The station's place at `date`, from its orbit data: latitude, longitude
 * (degrees), altitude (km) and speed (km/h); null if the orbit maths fails.
 */
export function issPosition(satrec, date) {
  const state = propagate(satrec, date)
  if (!state?.position) return null
  const geo = eciToGeodetic(state.position, gstime(date))
  const { x, y, z } = state.velocity
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    altitude: geo.height,
    speed: Math.hypot(x, y, z) * 3600,
  }
}

/** The orbit around `date` as a GeoJSON line, one point a minute. */
export function orbitPath(satrec, date) {
  const coordinates = []
  for (let m = -ORBIT_HALF_MINUTES; m <= ORBIT_HALF_MINUTES; m++) {
    const place = issPosition(satrec, new Date(date.getTime() + m * 60_000))
    if (place) coordinates.push([place.lon, place.lat])
  }
  return { type: 'LineString', coordinates }
}

export const clampTilt = (lat) => Math.max(-MAX_TILT, Math.min(MAX_TILT, lat))

function format(place) {
  const lat = `${Math.abs(place.lat).toFixed(1)}° ${place.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(place.lon).toFixed(1)}° ${place.lon >= 0 ? 'E' : 'W'}`
  return { lat, lon, altitude: `${Math.round(place.altitude)} km` }
}

/**
 * The globe, turning with the station: its view is the station's place plus
 * an offset that only dragging (or the arrow keys) changes, so you can look
 * from any side and the globe keeps following from there. React draws the
 * SVG; d3-geo only works out the shapes.
 */
export default function IssGlobe({ data }) {
  const satrec = useMemo(
    () => twoline2satrec(data.line1, data.line2),
    [data.line1, data.line2],
  )
  const [now, setNow] = useState(() => new Date())
  const [offset, setOffset] = useState([0, 0])
  const [drag, setDrag] = useState(null)
  const shadeId = useId()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const place = issPosition(satrec, now)
  // The orbit changes slowly; work it out once a minute, not every second.
  const minute = Math.floor(now.getTime() / 60_000)
  const orbit = useMemo(
    () => orbitPath(satrec, new Date(minute * 60_000)),
    [satrec, minute],
  )

  const centre = [
    (place?.lon ?? 0) + offset[0],
    clampTilt((place?.lat ?? 0) + offset[1]),
  ]
  const path = geoPath(
    geoOrthographic()
      .scale(SIZE / 2 - 2)
      .translate([SIZE / 2, SIZE / 2])
      .rotate([-centre[0], -centre[1]]),
  )

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ x: e.clientX, y: e.clientY, from: offset })
  }

  // Turn the view. The tilt is limited to what keeps the view on the globe,
  // so the offset never runs past it into a dead zone.
  function turnTo(lonOffset, latOffset) {
    const lat = place?.lat ?? 0
    setOffset([lonOffset, clampTilt(lat + latOffset) - lat])
  }

  function onPointerMove(e) {
    if (!drag) return
    turnTo(
      drag.from[0] - (e.clientX - drag.x) * DRAG_DEGREES_PER_PIXEL,
      drag.from[1] + (e.clientY - drag.y) * DRAG_DEGREES_PER_PIXEL,
    )
  }

  // Arrow keys turn the globe the way a drag in that direction would.
  // Marked handled, so the profile pager's own arrow keys (ProfilePager.jsx)
  // leave them alone.
  function onKeyDown(e) {
    const step = {
      ArrowLeft: [KEY_STEP_DEGREES, 0],
      ArrowRight: [-KEY_STEP_DEGREES, 0],
      ArrowUp: [0, -KEY_STEP_DEGREES],
      ArrowDown: [0, KEY_STEP_DEGREES],
    }[e.key]
    if (!step) return
    e.preventDefault()
    turnTo(offset[0] + step[0], offset[1] + step[1])
  }

  const shown = place && format(place)

  return (
    <div className="h-full flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={
          shown
            ? `ISS over ${shown.lat}, ${shown.lon}, ${shown.altitude} up. Drag or use the arrow keys to turn the globe.`
            : 'Globe; the station position is unavailable'
        }
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={onKeyDown}
        // pan-y: on a phone the page still scrolls past the card; the globe
        // turns sideways under a finger.
        className={`min-h-0 flex-1 w-full touch-pan-y select-none focus:outline-none focus-visible:outline-1 focus-visible:outline-text-muted ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <defs>
          <radialGradient id={shadeId} cx="38%" cy="35%" r="75%">
            <stop offset="0" stopColor="#1d232c" />
            <stop offset="1" stopColor="#0d1014" />
          </radialGradient>
        </defs>
        <path d={path(SPHERE)} fill={`url(#${shadeId})`} />
        <path
          d={path(GRATICULE)}
          fill="none"
          className="stroke-hairline"
          strokeWidth="0.6"
        />
        <path
          d={path(LAND)}
          className="fill-hairline-strong stroke-text-muted"
          strokeWidth="0.4"
          strokeOpacity="0.5"
        />
        <path
          d={path(orbit)}
          fill="none"
          className="stroke-card-iss"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />
        {place && (
          <path
            d={path.pointRadius(5)({
              type: 'Point',
              coordinates: [place.lon, place.lat],
            })}
            className="fill-card-iss"
          />
        )}
        <path d={path(SPHERE)} fill="none" className="stroke-hairline-strong" />
      </svg>
      <p className="flex flex-wrap justify-between gap-x-3 font-mono text-xs text-text-secondary">
        {shown ? (
          <>
            <span className="text-text-primary">
              {shown.lat} {shown.lon}
            </span>
            <span>
              {shown.altitude} ·{' '}
              {Math.round(place.speed).toLocaleString('en-US')} km/h
            </span>
          </>
        ) : (
          <span>The station&apos;s position is unavailable.</span>
        )}
      </p>
      {data.fallback && (
        <p className="text-xs text-text-muted">
          Approximate: orbit data from{' '}
          {new Date(data.epoch).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
