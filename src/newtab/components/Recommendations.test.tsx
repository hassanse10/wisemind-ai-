import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Recommendations } from './Recommendations'
import type { DailySummary, ExtensionSettings } from '../../shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date: '2026-06-27',
    totalTime: 3600,
    byCategory: {
      learning: 1800,
      programming: 900,
      productivity: 600,
      ai_tools: 300,
      reading: 0,
      entertainment: 0,
      gaming: 0,
      social_media: 0,
      news: 0,
      shopping: 0,
      finance: 0,
      health: 0,
      communication: 0,
      other: 0,
    },
    shortVideoCount: 5,
    shortVideoDuration: 300,
    healthScore: 72,
    productivityScore: 80,
    learningScore: 65,
    breaks: 2,
    lateNightMinutes: 0,
    topSites: [],
    ...overrides,
  }
}

function makeSettings(overrides: Partial<ExtensionSettings> = {}): ExtensionSettings {
  return {
    openrouterApiKey: 'test-key-abc',
    selectedModel: 'openai/gpt-4o-mini',
    mentorPersonality: 'wise',
    theme: 'dark',
    coachingEnabled: true,
    coachingFrequency: 'moderate',
    coachingHours: { start: 8, end: 22 },
    excludedDomains: [],
    privateModeActive: false,
    eyeHealthReminders: true,
    breakIntervalMinutes: 45,
    lastHealthScore: 72,
    todaysSummary: null,
    achievements: [],
    ruleLastFired: {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------
function mockFetchSuccess(recommendations: string[]) {
  const body = JSON.stringify({ recommendations })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: body } }] }),
    })
  )
}

function mockFetchReject() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Recommendations', () => {
  it('renders 3 recommendation cards from a mocked OpenRouter response', async () => {
    mockFetchSuccess(['Drink water now', 'Take a 5-min walk', 'Review your goals'])
    render(<Recommendations summary={makeSummary()} settings={makeSettings()} />)

    await waitFor(() => {
      expect(screen.getByText('Drink water now')).toBeInTheDocument()
      expect(screen.getByText('Take a 5-min walk')).toBeInTheDocument()
      expect(screen.getByText('Review your goals')).toBeInTheDocument()
    })

    // Title present
    expect(screen.getByText("Today's Recommendations")).toBeInTheDocument()

    // Fetch was called once
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
  })

  it('does NOT call fetch and renders the API key prompt when openrouterApiKey is empty', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(
      <Recommendations
        summary={makeSummary()}
        settings={makeSettings({ openrouterApiKey: '' })}
      />
    )

    expect(screen.getByText(/Add your OpenRouter API key/i)).toBeInTheDocument()
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })

  it('renders graceful fallback on fetch rejection without throwing', async () => {
    mockFetchReject()
    render(<Recommendations summary={makeSummary()} settings={makeSettings()} />)

    await waitFor(() => {
      expect(screen.getByText(/Recommendations unavailable/i)).toBeInTheDocument()
    })
  })

  it('does NOT call fetch and renders paused message when privateModeActive is true', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(
      <Recommendations
        summary={makeSummary()}
        settings={makeSettings({ privateModeActive: true })}
      />
    )

    expect(screen.getByText(/Recommendations are paused in Private Mode/i)).toBeInTheDocument()
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })

  it('renders only the first 3 recommendations when the API returns more', async () => {
    mockFetchSuccess(['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'])
    render(<Recommendations summary={makeSummary()} settings={makeSettings()} />)

    await waitFor(() => {
      expect(screen.getByText('Tip 1')).toBeInTheDocument()
      expect(screen.getByText('Tip 2')).toBeInTheDocument()
      expect(screen.getByText('Tip 3')).toBeInTheDocument()
    })

    expect(screen.queryByText('Tip 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Tip 5')).not.toBeInTheDocument()
  })
})
