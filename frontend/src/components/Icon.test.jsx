import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import Icon, { ICONS } from './Icon'

describe('Icon', () => {
  it.each(Object.keys(ICONS))('draws an svg for "%s"', (name) => {
    const { container } = render(<Icon name={name} />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('data-icon', name)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    ['an unknown name', 'rocket'],
    ['an empty name', ''],
    ['an emoji', '☀️'],
    ['no name', undefined],
  ])('draws nothing for %s', (_, name) => {
    const { container } = render(<Icon name={name} />)

    expect(container).toBeEmptyDOMElement()
  })
})
