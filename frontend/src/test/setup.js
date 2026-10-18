import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { mediaQueryList } from './helpers'

// jsdom does not implement ResizeObserver, which react-grid-layout's
// useContainerWidth depends on. A no-op stub is enough: layout maths is the
// library's concern, not ours.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

// jsdom implements no SVG geometry, so a path cannot measure itself. The brand
// lockup walks its track with these; returning plausible constants lets the
// component mount and its animation logic run. Note jsdom has no
// SVGPathElement at all - a <path> is a plain SVGElement - so these go on the
// base prototype.
if (globalThis.SVGElement) {
  SVGElement.prototype.getTotalLength ??= () => 100
  SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 })
}

// Same story for matchMedia, which jsdom also omits.
globalThis.matchMedia ??= (query) => mediaQueryList(query)

beforeEach(() => {
  // No test may reach the network. Every test that expects a request must stub
  // fetch itself; anything unstubbed fails loudly here instead of hanging.
  globalThis.fetch = vi.fn(() =>
    Promise.reject(
      new Error(
        'Unexpected network call: stub globalThis.fetch in the test that needs it.',
      ),
    ),
  )
})

afterEach(() => {
  cleanup()
})
