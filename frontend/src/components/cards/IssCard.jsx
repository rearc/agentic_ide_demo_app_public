import { lazy, Suspense } from 'react'
import LoadingDots from '../LoadingDots'

// The globe and its libraries (d3-geo, satellite.js, the world's outline)
// load only when this card is on screen, so the app's first load carries
// none of them.
const IssGlobe = lazy(() => import('./IssGlobe'))

/** The International Space Station, live, on a globe you can spin. */
export default function IssCard({ data }) {
  if (!data) return null
  return (
    <Suspense fallback={<LoadingDots label="Loading the globe" />}>
      <IssGlobe data={data} />
    </Suspense>
  )
}
