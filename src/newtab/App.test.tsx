import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    lastHealthScore: 78,
    todaysSummary: {
      healthScore: 78,
      productivityScore: 65,
      learningScore: 55,
      shortVideoCount: 12,
      shortVideoDuration: 720,
      totalTime: 18000,
      byCategory: { programming: 5400, entertainment: 3600 },
      topSites: [{ domain: 'github.com', duration: 5400 }],
      breaks: 3,
      lateNightMinutes: 0,
      date: '2026-06-27',
    },
    achievements: [],
    mentorPersonality: 'wise',
    openrouterApiKey: 'key',
    selectedModel: 'openai/gpt-4o-mini',
  }),
}))

vi.mock('../shared/db', () => ({
  getLastNDailySummaries: vi.fn().mockResolvedValue([]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
  getActiveGoals: vi.fn().mockResolvedValue([]),
  addGoal: vi.fn().mockResolvedValue(undefined),
  putGoal: vi.fn().mockResolvedValue(undefined),
}))

describe('NewTab App', () => {
  it('renders health score card', () => {
    render(<App />)
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('renders short video count', () => {
    render(<App />)
    expect(screen.getAllByText(/12/).length).toBeGreaterThan(0)
  })

  it('renders WiseMind AI heading', () => {
    render(<App />)
    expect(screen.getByText('WiseMind AI')).toBeInTheDocument()
  })

  it('renders productivity score', () => {
    render(<App />)
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('renders learning score', () => {
    render(<App />)
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('renders short video report when count > 0', () => {
    render(<App />)
    expect(screen.getByText(/videos watched/i)).toBeInTheDocument()
  })

  it('renders short video duration in minutes', () => {
    render(<App />)
    // 720 seconds = 12 minutes
    expect(screen.getByText('12m')).toBeInTheDocument()
  })

  it('renders Today\'s Timeline section', () => {
    render(<App />)
    expect(screen.getByText(/Today's Timeline/i)).toBeInTheDocument()
  })

  it('renders Achievements section', () => {
    render(<App />)
    expect(screen.getByText('Achievements')).toBeInTheDocument()
  })

  it('renders score labels', () => {
    render(<App />)
    expect(screen.getAllByText('Health').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Productivity').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Learning').length).toBeGreaterThan(0)
  })
})
