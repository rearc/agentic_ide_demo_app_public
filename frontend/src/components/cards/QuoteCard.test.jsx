import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import QuoteCard from './QuoteCard'

const QUOTE = {
  text: 'Simplicity is the soul of efficiency.',
  author: 'Austin Freeman',
}

describe('QuoteCard', () => {
  it('renders the quote and its author', () => {
    render(<QuoteCard data={QUOTE} />)

    expect(
      screen.getByText('Simplicity is the soul of efficiency.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Austin Freeman/)).toBeInTheDocument()
  })

  it('renders nothing when it has no data', () => {
    const { container } = render(<QuoteCard data={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('does not mark a live quote as offline', () => {
    render(<QuoteCard data={QUOTE} />)

    expect(screen.queryByText('(offline)')).not.toBeInTheDocument()
  })

  it('marks a fallback quote as offline', () => {
    render(<QuoteCard data={{ ...QUOTE, fallback: true }} />)

    expect(screen.getByText('(offline)')).toBeInTheDocument()
  })

  it('credits ZenQuotes with a link on a live quote', () => {
    render(<QuoteCard data={QUOTE} />)

    expect(screen.getByRole('link', { name: 'via ZenQuotes' })).toHaveAttribute(
      'href',
      'https://zenquotes.io/',
    )
  })

  it('does not credit ZenQuotes for the built-in fallback quote', () => {
    render(<QuoteCard data={{ ...QUOTE, fallback: true }} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
