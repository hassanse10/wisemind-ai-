import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useScores } from './useScores'
import { DEFAULT_SETTINGS } from '../StorageManager'

vi.mock('../StorageManager', () => ({
  DEFAULT_SETTINGS: {
    coachingEnabled: true,
    mentorPersonality: 'wise',
    selectedModel: 'openai/gpt-4o-mini',
    theme: 'system',
    coachingFrequency: 'moderate',
    coachingHours: { start: 9, end: 22 },
    excludedDomains: [],
    privateModeActive: false,
    eyeHealthReminders: true,
    lastHealthScore: 0,
    todaysSummary: null,
    achievements: [],
    ruleLastFired: {},
    openrouterApiKey: '',
  },
  getSettings: vi.fn(),
}))

describe('useScores', () => {
  let addListenerFn: ((listener: Function) => void) | null = null
  let removeListenerFn: ((listener: Function) => void) | null = null
  let listeners: Function[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    listeners = []

    // Mock chrome.runtime.onMessage
    addListenerFn = (listener: Function) => {
      listeners.push(listener)
    }
    removeListenerFn = (listener: Function) => {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }

    // @ts-ignore
    global.chrome = {
      runtime: {
        onMessage: {
          addListener: addListenerFn,
          removeListener: removeListenerFn,
        },
      },
    }
  })

  afterEach(() => {
    listeners = []
  })

  it('returns scores from settings', async () => {
    const { getSettings } = await import('../StorageManager')
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      lastHealthScore: 75,
      todaysSummary: {
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
        shortVideoCount: 0,
        shortVideoDuration: 0,
        healthScore: 85,
        productivityScore: 60,
        learningScore: 45,
        breaks: 2,
        lateNightMinutes: 0,
        topSites: [],
      },
    })

    const { result } = renderHook(() => useScores())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.health).toBe(85)
    expect(result.current?.productivity).toBe(60)
    expect(result.current?.learning).toBe(45)
  })

  it('listens for SCORE_UPDATE messages', async () => {
    const { getSettings } = await import('../StorageManager')
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      lastHealthScore: 75,
      todaysSummary: null,
    })

    const { result } = renderHook(() => useScores())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(listeners).toHaveLength(1)

    // Simulate a SCORE_UPDATE message
    const listener = listeners[0]
    listener({
      type: 'SCORE_UPDATE',
      payload: { health: 90, productivity: 75, learning: 80 },
    })

    await waitFor(() => {
      expect(result.current?.health).toBe(90)
      expect(result.current?.productivity).toBe(75)
      expect(result.current?.learning).toBe(80)
    })
  })

  it('removes listener on unmount', async () => {
    const { getSettings } = await import('../StorageManager')
    vi.mocked(getSettings).mockResolvedValue({
      ...DEFAULT_SETTINGS,
      lastHealthScore: 75,
      todaysSummary: null,
    })

    const { unmount } = renderHook(() => useScores())
    await waitFor(() => expect(listeners).toHaveLength(1))

    unmount()
    expect(listeners).toHaveLength(0)
  })
})
