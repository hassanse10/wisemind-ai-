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
// Popup reads today's counts straight from the shared database.
vi.mock('../shared/db', () => ({
  getShortVideosByDateRange: vi.fn().mockResolvedValue([
    { id: 's1', platform: 'youtube_shorts', count: 23, duration: 600, startTime: 0, endTime: 0 },
  ]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
}))

describe('Popup App', () => {
  it('renders health score', () => {
    render(<App />)
    expect(screen.getAllByText('82').length).toBeGreaterThan(0)
  })

  it('shows live short video count from the database', async () => {
    render(<App />)
    // card only renders when the live DB count (mocked to 23) is > 0
    expect(await screen.findByText(/Shorts today/i)).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('shows the tracked-today diagnostic line', async () => {
    render(<App />)
    expect(await screen.findByText(/tracked today/i)).toBeInTheDocument()
  })
})
