import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { WeeklyInsight } from './WeeklyInsight'
import type { DailySummary, ExtensionSettings, Goal } from '../../shared/types'

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
    lastHealthScore: 72,
    todaysSummary: null,
    achievements: [],
    ruleLastFired: {},
    ...overrides,
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    type: 'reduce',
    target: 'social_media',
    dailyLimitMinutes: 30,
    weeklyTargetMinutes: null,
    createdAt: Date.now(),
    active: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------
function mockFetchSuccess(content: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content } }] }),
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
describe('WeeklyInsight', () => {
  it('renders reflection text from a mocked OpenRouter response with >=2 summaries', async () => {
    const reflection = 'Great week. You learned a lot. Keep it up.'
    mockFetchSuccess(reflection)

    const summaries = [makeSummary({ date: '2026-06-26' }), makeSummary({ date: '2026-06-27' })]
    render(
      <WeeklyInsight
        summaries={summaries}
        goals={[makeGoal()]}
        settings={makeSettings()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(reflection)).toBeInTheDocument()
    })

    expect(screen.getByText('Weekly Insight')).toBeInTheDocument()
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1)
  })

  it('does NOT call fetch and renders the API key prompt when openrouterApiKey is empty', () => {
    vi.stubGlobal('fetch', vi.fn())

    const summaries = [makeSummary({ date: '2026-06-26' }), makeSummary({ date: '2026-06-27' })]
    render(
      <WeeklyInsight
        summaries={summaries}
        goals={[]}
        settings={makeSettings({ openrouterApiKey: '' })}
      />
    )

    expect(screen.getByText(/Add your OpenRouter API key/i)).toBeInTheDocument()
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })

  it('renders nothing (null) when summaries.length < 2', () => {
    vi.stubGlobal('fetch', vi.fn())

    const { container } = render(
      <WeeklyInsight
        summaries={[makeSummary()]}
        goals={[]}
        settings={makeSettings()}
      />
    )

    expect(container.firstChild).toBeNull()
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })

  it('renders graceful fallback on fetch rejection without throwing', async () => {
    mockFetchReject()

    const summaries = [makeSummary({ date: '2026-06-26' }), makeSummary({ date: '2026-06-27' })]
    render(
      <WeeklyInsight
        summaries={summaries}
        goals={[]}
        settings={makeSettings()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/Weekly insight unavailable/i)).toBeInTheDocument()
    })
  })
})
