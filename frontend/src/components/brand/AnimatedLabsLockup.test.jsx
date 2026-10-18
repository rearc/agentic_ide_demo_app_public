import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AnimatedLabsLockup from './AnimatedLabsLockup'
import { mediaQueryList } from '../../test/helpers'

/* Presentational brand mark, so these tests cover the contract rather than the
   drawing: it exposes an accessible name, it drives a requestAnimationFrame
   loop, and it stops that loop when it goes away or when the user has asked for
   reduced motion. */

function stubReducedMotion(matches) {
  vi.stubGlobal('matchMedia', (query) => mediaQueryList(query, matches))
}

describe('AnimatedLabsLockup', () => {
  it('exposes its title as an accessible name', () => {
    render(<AnimatedLabsLockup title="Rearc AI Labs" />)

    expect(
      screen.getByRole('img', { name: 'Rearc AI Labs' }),
    ).toBeInTheDocument()
  })

  it('animates when motion is allowed', () => {
    stubReducedMotion(false)
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')

    render(<AnimatedLabsLockup title="Rearc AI Labs" />)

    expect(raf).toHaveBeenCalled()
  })

  it('does not animate when the user prefers reduced motion', () => {
    stubReducedMotion(true)
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')

    render(<AnimatedLabsLockup title="Rearc AI Labs" />)

    expect(raf).not.toHaveBeenCalled()
  })

  it('cancels its animation frame on unmount', () => {
    stubReducedMotion(false)
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')

    const { unmount } = render(<AnimatedLabsLockup title="Rearc AI Labs" />)
    unmount()

    expect(cancel).toHaveBeenCalled()
  })
})
