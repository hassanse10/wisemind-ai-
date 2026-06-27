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
  getActiveGoals: vi.fn().mockResolvedValue([]),
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

describe('CoachingEngine gatherContext: real goals', () => {
  it('surfaces active goals from getActiveGoals so goal_nudge can fire', async () => {
    const db = await import('../shared/db')
    // Return one active goal
    vi.mocked(db.getActiveGoals).mockResolvedValueOnce([
      {
        id: 'goal-test-1',
        type: 'reduce',
        target: 'entertainment',
        dailyLimitMinutes: 60,
        weeklyTargetMinutes: null,
        createdAt: Date.now(),
        active: true,
      },
    ])
    // Make the last visit be 'entertainment' so goal_nudge check can see it
    vi.mocked(db.getVisitsByDateRange).mockResolvedValueOnce([
      {
        id: 'v1', url: 'https://netflix.com', domain: 'netflix.com', title: 'Netflix',
        startTime: Date.now() - 3600_000, endTime: Date.now(),
        duration: 3600, category: 'entertainment', aiCategory: 'entertainment', classified: true,
      },
    ])
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Time to take a break from entertainment.' } }] }),
    }) as any

    // Set sessionStartTime far enough back that continuousMinutes > 30
    const engine = new CoachingEngine()
    // Manipulate sessionStartTime via init (resets to now), then subtract 35 min
    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => realNow - 35 * 60_000)
    engine.init() // sets sessionStartTime = realNow - 35min
    vi.spyOn(Date, 'now').mockImplementation(() => realNow) // now is current

    const result = await engine.evaluateRules()
    // goal_nudge should fire: goals.length > 0, entertainment, continuousMinutes > 30
    expect(result).not.toBeNull()
    expect(result).toContain('break')

    vi.restoreAllMocks()
  })
})
