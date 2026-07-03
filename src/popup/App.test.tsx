import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from './App'

const mockUpdateSettings = vi.fn()

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    todaysSummary: { healthScore: 82, productivityScore: 75, learningScore: 60,
      shortVideoCount: 23, totalTime: 14400, byCategory: {},
      topSites: [
        { domain: 'github.com', duration: 2520 },
        { domain: 'youtube.com', duration: 1800 },
        { domain: 'news.ycombinator.com', duration: 900 },
        { domain: 'example.com', duration: 60 },
      ],
      breaks: 2, lateNightMinutes: 0, shortVideoDuration: 0, date: '2026-06-27' },
    lastHealthScore: 82,
    privateModeActive: false,
  }),
}))
vi.mock('../shared/StorageManager', () => ({
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
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

  it('shows the top 3 sites by duration, not the 4th', () => {
    render(<App />)
    expect(screen.getByText('github.com')).toBeInTheDocument()
    expect(screen.getByText('42m')).toBeInTheDocument()
    expect(screen.getByText('youtube.com')).toBeInTheDocument()
    expect(screen.getByText('news.ycombinator.com')).toBeInTheDocument()
    expect(screen.queryByText('example.com')).not.toBeInTheDocument()
  })

  it('toggles private mode when the lock button is clicked', () => {
    render(<App />)
    const btn = screen.getByRole('button', { name: 'Private mode' })
    fireEvent.click(btn)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ privateModeActive: true })
  })
})
