import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TimerCard, { INITIAL, POMODORO, timerReducer } from './TimerCard'

const MINUTE = 60_000

// Fake timers drive both the card's tick and Date.now(). fireEvent, not
// userEvent: userEvent waits on real timers between steps.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

function press(name) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function pass(ms) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function shown() {
  return screen.getByText(/^\d\d:\d\d$/).textContent
}

describe('timer mode', () => {
  it('counts down from the chosen preset once started, and pauses', () => {
    render(<TimerCard />)

    press('5 minutes')
    expect(shown()).toBe('05:00')

    press('Start')
    pass(61_000)
    expect(shown()).toBe('03:59')

    press('Pause')
    pass(30_000)
    expect(shown()).toBe('03:59')
  })

  it('takes a custom length a minute at a time', () => {
    render(<TimerCard />)

    press('One minute more')
    press('One minute more')

    expect(shown()).toBe('27:00')
  })

  it('resets to the chosen time', () => {
    render(<TimerCard />)
    press('10 minutes')
    press('Start')
    pass(90_000)

    press('Reset')

    expect(shown()).toBe('10:00')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('flashes when time is up until clicked, then waits at the chosen time', () => {
    render(<TimerCard />)
    press('5 minutes')
    press('Start')

    pass(5 * MINUTE)

    const card = screen.getByText('00:00').closest('[data-done]')
    expect(card).toHaveAttribute('data-done', 'true')
    expect(card).toHaveClass('animate-timer-done')

    fireEvent.click(card)

    expect(card).toHaveAttribute('data-done', 'false')
    expect(shown()).toBe('05:00')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('can be dismissed from the keyboard with its done button', () => {
    render(<TimerCard />)
    press('5 minutes')
    press('Start')
    pass(5 * MINUTE)

    press('Time is up')

    expect(shown()).toBe('05:00')
  })
})

describe('while it flashes', () => {
  function finishFiveMinutes() {
    press('5 minutes')
    press('Start')
    pass(5 * MINUTE)
  }

  it('hides its other controls, so the only thing to do is acknowledge it', () => {
    render(<TimerCard />)
    finishFiveMinutes()

    expect(screen.queryByRole('button', { name: 'Pomodoro' })).toBeNull()
    expect(screen.queryByRole('button', { name: '5 minutes' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
  })

  it('keeps keyboard focus on its main button as it goes from Start to done and back', () => {
    render(<TimerCard />)
    press('5 minutes')
    screen.getByRole('button', { name: 'Start' }).focus()
    press('Start')
    pass(5 * MINUTE)

    expect(screen.getByRole('button', { name: 'Time is up' })).toHaveFocus()

    press('Time is up')

    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus()
  })

  it('never takes focus from the rest of the page', () => {
    render(
      <>
        <input aria-label="Elsewhere" />
        <TimerCard />
      </>,
    )
    finishFiveMinutes()
    screen.getByRole('textbox', { name: 'Elsewhere' }).focus()

    press('Time is up')

    expect(screen.getByRole('textbox', { name: 'Elsewhere' })).toHaveFocus()
  })
})

describe('Pomodoro mode', () => {
  it('starts a 25 minute focus and says the round in the header', () => {
    const onNote = vi.fn()
    render(<TimerCard onNote={onNote} />)

    press('Pomodoro')

    expect(shown()).toBe('25:00')
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(onNote).toHaveBeenLastCalledWith('Round 1 of 4')
  })

  it('loads the break once a focus is done and dismissed, waiting for Start', () => {
    render(<TimerCard />)
    press('Pomodoro')
    press('Start')
    pass(POMODORO.focus * MINUTE)

    press('Focus done, take a 5 minute break')

    expect(screen.getByText('Short break')).toBeInTheDocument()
    expect(shown()).toBe('05:00')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('clears the header note in timer mode', () => {
    const onNote = vi.fn()
    render(<TimerCard onNote={onNote} />)
    press('Pomodoro')

    press('Timer')

    expect(onNote).toHaveBeenLastCalledWith(null)
  })
})

describe('timerReducer', () => {
  function finishAndDismiss(state) {
    return timerReducer(timerReducer(state, { type: 'finish' }), {
      type: 'dismiss',
    })
  }

  it('gives a long break after the fourth focus, then starts round one again', () => {
    let state = timerReducer(INITIAL, { type: 'mode', mode: 'pomodoro' })
    // Focus then short break, for rounds one to three: six phases done.
    for (let i = 0; i < 6; i++) state = finishAndDismiss(state)
    expect(state).toMatchObject({ phase: 'focus', round: 4 })

    state = finishAndDismiss(state)
    expect(state).toMatchObject({ phase: 'long', round: 4 })
    expect(state.left).toBe(POMODORO.long * MINUTE)

    state = finishAndDismiss(state)
    expect(state).toMatchObject({ phase: 'focus', round: 1 })
  })

  it('keeps the time left across a pause, measured from when it will end', () => {
    const started = timerReducer(INITIAL, { type: 'start', now: 1_000 })

    const paused = timerReducer(started, { type: 'pause', now: 61_000 })

    expect(paused.left).toBe(INITIAL.left - MINUTE)
    expect(paused.endsAt).toBeNull()
  })

  it('leaves a running timer alone when its own mode is chosen again', () => {
    const started = timerReducer(INITIAL, { type: 'start', now: 0 })

    expect(timerReducer(started, { type: 'mode', mode: 'timer' })).toBe(started)
  })

  it('keeps a custom length between 1 and 180 minutes', () => {
    expect(timerReducer(INITIAL, { type: 'minutes', minutes: 0 }).minutes).toBe(
      1,
    )
    expect(
      timerReducer(INITIAL, { type: 'minutes', minutes: 500 }).minutes,
    ).toBe(180)
  })
})
