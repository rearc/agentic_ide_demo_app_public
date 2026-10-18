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

  it('credits ZenQuotes on a live quote, without a fallback note', () => {
    render(<QuoteCard data={QUOTE} />)

    expect(screen.getByRole('link', { name: 'via ZenQuotes' })).toHaveAttribute(
      'href',
      'https://zenquotes.io/',
    )
    expect(screen.queryByText(/did not answer/)).not.toBeInTheDocument()
  })

  it('says why it shows the built-in quote instead of crediting ZenQuotes', () => {
    render(<QuoteCard data={{ ...QUOTE, fallback: true }} />)

    expect(
      screen.getByText('ZenQuotes did not answer: showing a built-in quote'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
