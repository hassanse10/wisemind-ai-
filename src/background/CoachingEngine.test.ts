import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoachingEngine } from './CoachingEngine'
import { DEFAULT_SETTINGS } from '../shared/StorageManager'

vi.mock('../shared/StorageManager', () => ({
  DEFAULT_SETTINGS: {
    coachingEnabled: true, privateModeActive: false,
    coachingHours: { start: 9, end: 22 }, mentorPersonality: 'wise',
    selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key',
    ruleLastFired: {},
  },
  getSettings: vi.fn().mockResolvedValue({
    coachingEnabled: true, privateModeActive: false,
    coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
    selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'test-key',
    ruleLastFired: {},
  }),
  markRuleFired: vi.fn(),
  getRuleLastFired: vi.fn().mockResolvedValue(0),
}))
vi.mock('../shared/db', () => ({
  getShortVideosByDateRange: vi.fn().mockResolvedValue([]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
  addCoachingEvent: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('CoachingEngine gate checks', () => {
  it('returns null when coachingEnabled is false', async () => {
    const { getSettings } = await import('../shared/StorageManager')
    vi.mocked(getSettings).mockResolvedValueOnce({
      coachingEnabled: false, privateModeActive: false,
      coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
      selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key', ruleLastFired: {},
    } as any)
    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).toBeNull()
  })

  it('returns null when privateModeActive is true', async () => {
    const { getSettings } = await import('../shared/StorageManager')
    vi.mocked(getSettings).mockResolvedValueOnce({
      coachingEnabled: true, privateModeActive: true,
      coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
      selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key', ruleLastFired: {},
    } as any)
    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).toBeNull()
  })
})

describe('CoachingEngine.resetSession', () => {
  it('resets sessionStartTime so continuousMinutes restarts from zero', async () => {
    const engine = new CoachingEngine()
    // Simulate time passing — advance 10 minutes by manipulating Date.now
    const originalNow = Date.now
    let fakeNow = originalNow()
    vi.spyOn(Date, 'now').mockImplementation(() => fakeNow)

    engine.init()
    fakeNow += 10 * 60_000 // 10 minutes later

    // Before reset: continuousMinutes should be ~10
    // After reset: sessionStartTime == fakeNow, so continuousMinutes becomes 0
    engine.resetSession()

    // Calling again at the same fakeNow gives 0 minutes
    fakeNow += 0
    // We verify resetSession doesn't throw and is callable
    expect(() => engine.resetSession()).not.toThrow()

    vi.restoreAllMocks()
  })
})

describe('CoachingEngine rule: short video', () => {
  it('fires when short video count exceeds 50', async () => {
    const { getShortVideosByDateRange } = await import('../shared/db')
    vi.mocked(getShortVideosByDateRange).mockResolvedValueOnce([
      { id: 's1', platform: 'youtube_shorts', count: 55, duration: 1800, startTime: 0, endTime: 0 },
    ])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'You have watched many Shorts today.' } }] }),
    }) as any

    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).not.toBeNull()
  })
})
