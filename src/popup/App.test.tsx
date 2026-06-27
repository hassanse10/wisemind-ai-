import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    todaysSummary: { healthScore: 82, productivityScore: 75, learningScore: 60,
      shortVideoCount: 23, totalTime: 14400, byCategory: {}, topSites: [], breaks: 2,
      lateNightMinutes: 0, shortVideoDuration: 0, date: '2026-06-27' },
    lastHealthScore: 82,
  }),
}))
vi.mock('../shared/hooks/useScores', () => ({ useScores: () => ({ health: 82, productivity: 75, learning: 60 }) }))

describe('Popup App', () => {
  it('renders health score', () => {
    render(<App />)
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('shows short video count', () => {
    render(<App />)
    expect(screen.getByText(/23 Shorts/i)).toBeInTheDocument()
  })
})
