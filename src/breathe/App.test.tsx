import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Breathe App', () => {
  it('renders the first phase, the cycle counter, and a Done button', () => {
    render(<App />)
    expect(screen.getByText('Breathe in')).toBeInTheDocument()
    expect(screen.getByText('Cycle 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })
})
