import { useEffect, useId, useMemo, useState } from 'react'
import { geoGraticule10, geoOrthographic, geoPath, geoRotation } from 'd3-geo'
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
// The orbit is drawn as a ring this much wider than the globe. At true scale
// (the station flies about 420 km up, 1.07 times Earth's radius) it would
// hardly leave the surface.
const RING_SCALE = 1.14
const GLOBE_RADIUS = SIZE / 2 / RING_SCALE - 2
const RING_RADIUS = GLOBE_RADIUS * RING_SCALE
const DEGREES = Math.PI / 180
const LAND = feature(land110m, land110m.objects.land)
const GRATICULE = geoGraticule10()
const SPHERE = { type: 'Sphere' }
// One orbit takes about 92 minutes; the path shows half of it either side.
const ORBIT_HALF_MINUTES = 46
const DRAG_DEGREES_PER_PIXEL = 0.4
const KEY_STEP_DEGREES = 10
const START_OFFSET = [0, 30]
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

/**
 * The orbit around `date`, one point a minute, as a GeoJSON line: the path
 * the station follows through space, so the Earth is held still at `date`
 * (a ground track would also turn with the Earth beneath it).
 */
export function orbitPath(satrec, date) {
  const earthTurn = gstime(date)
  const coordinates = []
  for (let m = -ORBIT_HALF_MINUTES; m <= ORBIT_HALF_MINUTES; m++) {
    const state = propagate(satrec, new Date(date.getTime() + m * 60_000))
    if (!state?.position) continue
    const geo = eciToGeodetic(state.position, earthTurn)
    coordinates.push([degreesLong(geo.longitude), degreesLat(geo.latitude)])
  }
  return { type: 'LineString', coordinates }
}

/**
 * Where a place sits on the ring, seen from the globe's current view: its
 * point on screen, and whether it is on the near side (`front`). This is
 * d3's orthographic projection worked by hand at the ring's radius, because
 * d3 would hide the far half, and the part of the far half that shows past
 * the globe's edge must still be drawn.
 */
function onRing(turn, lonLat) {
  const [lon, lat] = turn(lonLat).map((d) => d * DEGREES)
  return {
    point: [
      SIZE / 2 + RING_RADIUS * Math.cos(lat) * Math.sin(lon),
      SIZE / 2 - RING_RADIUS * Math.sin(lat),
    ],
    front: Math.cos(lat) * Math.cos(lon) >= 0,
  }
}

/** The ring as SVG paths, split into its near and far stretches. */
function ringPaths(turn, orbit) {
  const paths = { front: [], back: [] }
  let run = null
  for (const lonLat of orbit.coordinates) {
    const { point, front } = onRing(turn, lonLat)
    if (run?.front !== front) {
      // Each stretch starts where the last ended, so the ring has no gaps.
      run = { front, points: run ? [run.points.at(-1), point] : [point] }
      paths[front ? 'front' : 'back'].push(run.points)
    } else {
      run.points.push(point)
    }
  }
  const toPath = (points) => `M${points.map((p) => p.join(',')).join('L')}`
  return { front: paths.front.map(toPath), back: paths.back.map(toPath) }
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
  // Seen from straight above the station, its orbit is edge-on, a line
  // through the globe; looking from a little north of it opens the ring out.
  const [offset, setOffset] = useState(START_OFFSET)
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
  const rotate = [-centre[0], -centre[1]]
  const path = geoPath(
    geoOrthographic()
      .scale(GLOBE_RADIUS)
      .translate([SIZE / 2, SIZE / 2])
      .rotate(rotate),
  )
  const turn = geoRotation(rotate)
  const ring = ringPaths(turn, orbit)
  const station = place && onRing(turn, [place.lon, place.lat])

  // Drawn twice, once behind the globe and once in front, so the globe hides
  // what is behind it.
  const ringStretches = (stretches) =>
    stretches.map((d, i) => (
      <path
        key={i}
        d={d}
        fill="none"
        className="stroke-card-iss"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />
    ))
  const stationDot = station && (
    <circle
      data-station
      cx={station.point[0]}
      cy={station.point[1]}
      r="5"
      className="fill-card-iss"
    />
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
        {ringStretches(ring.back)}
        {!station?.front && stationDot}
        <path d={path(SPHERE)} fill={`url(#${shadeId})`} />
        <path
          d={path(GRATICULE)}
          fill="none"
          className="stroke-hairline"
          strokeWidth="0.6"
        />
        <path
          data-layer="land"
          d={path(LAND)}
          className="fill-hairline-strong stroke-text-muted"
          strokeWidth="0.4"
          strokeOpacity="0.5"
        />
        <path d={path(SPHERE)} fill="none" className="stroke-hairline-strong" />
        {ringStretches(ring.front)}
        {station?.front && stationDot}
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
