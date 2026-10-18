import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SpaceCard from './SpaceCard'

const APOD = {
  title: 'Pillars of Creation',
  url: 'https://apod.nasa.gov/apod/image/pillars.jpg',
  explanation: 'A star-forming region in the Eagle Nebula.',
  date: '2026-07-19',
  media_type: 'image',
}

describe('SpaceCard', () => {
  it('renders the title, explanation and date', () => {
    render(<SpaceCard data={APOD} />)

    expect(screen.getByText('Pillars of Creation')).toBeInTheDocument()
    expect(
      screen.getByText('A star-forming region in the Eagle Nebula.'),
    ).toBeInTheDocument()
    expect(screen.getByText('2026-07-19')).toBeInTheDocument()
  })

  it('renders nothing when it has no data', () => {
    const { container } = render(<SpaceCard data={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  describe('image media type', () => {
    it('renders the image with the title as alt text', () => {
      render(<SpaceCard data={APOD} />)

      const image = screen.getByRole('img', { name: 'Pillars of Creation' })
      expect(image).toHaveAttribute('src', APOD.url)
    })
  })

  describe('video media type', () => {
    it('renders a link instead of an image', () => {
      render(<SpaceCard data={{ ...APOD, media_type: 'video' }} />)

      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: /Watch today's space video/ }),
      ).toHaveAttribute('href', APOD.url)
    })

    it('opens the video safely in a new tab', () => {
      render(<SpaceCard data={{ ...APOD, media_type: 'video' }} />)

      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('renders neither image nor link when there is no url', () => {
    render(<SpaceCard data={{ ...APOD, url: '' }} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Pillars of Creation')).toBeInTheDocument()
  })

  describe('fallback state (ADR-009)', () => {
    const FALLBACK = {
      fallback: true,
      title: 'Space Photo Unavailable',
      url: '',
      explanation: 'Set NASA_API_KEY in .env for Astronomy Picture of the Day',
      date: '',
      media_type: 'image',
    }

    it('shows the explanation in place of the photo and its title', () => {
      /* The success branch renders the explanation too, so the absent title
         heading is what proves this branch ran. */
      render(<SpaceCard data={FALLBACK} />)

      expect(screen.getByText(FALLBACK.explanation)).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })
})
