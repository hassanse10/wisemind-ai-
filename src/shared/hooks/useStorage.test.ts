import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSettings } from './useStorage'
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
  getSettings: vi.fn().mockResolvedValue({ coachingEnabled: true, mentorPersonality: 'wise' }),
}))

describe('useSettings', () => {
  it('returns settings after async load', async () => {
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.coachingEnabled).toBe(true)
  })
})
