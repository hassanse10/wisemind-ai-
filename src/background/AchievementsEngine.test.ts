import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DailySummary, Achievement } from '../shared/types'

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockGetLastNDailySummaries = vi.fn()
const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)

vi.mock('../shared/db', () => ({
  getLastNDailySummaries: mockGetLastNDailySummaries,
}))

vi.mock('../shared/StorageManager', () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────

type SummaryOverrides = Omit<Partial<DailySummary>, 'byCategory'> & {
  date: string
  byCategory?: Partial<DailySummary['byCategory']>
}

/** Build a minimal DailySummary with all category seconds = 0 unless overridden. */
function makeSummary(overrides: SummaryOverrides): DailySummary {
  return {
    date: overrides.date,
    totalTime: 0,
    byCategory: {
      learning: 0,
      programming: 0,
      productivity: 0,
      ai_tools: 0,
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
      ...overrides.byCategory,
    },
    shortVideoCount: 0,
    shortVideoDuration: 0,
    healthScore: overrides.healthScore ?? 0,
    productivityScore: overrides.productivityScore ?? 0,
    learningScore: overrides.learningScore ?? 0,
    breaks: overrides.breaks ?? 0,
    lateNightMinutes: 0,
    topSites: [],
  }
}

function makeSettings(achievements: Achievement[] = []) {
  return {
    openrouterApiKey: '',
    selectedModel: 'openai/gpt-4o-mini',
    mentorPersonality: 'wise',
    theme: 'system',
    coachingEnabled: true,
    coachingFrequency: 'moderate',
    coachingHours: { start: 9, end: 22 },
    excludedDomains: [],
    privateModeActive: false,
    eyeHealthReminders: true,
    lastHealthScore: 0,
    todaysSummary: null,
    achievements,
    ruleLastFired: {},
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('AchievementsEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateSettings.mockResolvedValue(undefined)
  })

  // ── deep_learner ────────────────────────────────────────────────────────

  describe('deep_learner', () => {
    it('unlocks when a day has learningScore >= 90', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', learningScore: 90 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('deep_learner')
    })

    it('does NOT unlock when learningScore < 90 on all days', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', learningScore: 89 }),
        makeSummary({ date: '2024-12-31', learningScore: 50 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('deep_learner')
    })
  })

  // ── seven_day_focus ─────────────────────────────────────────────────────

  describe('seven_day_focus', () => {
    it('unlocks when all 7 days have productivityScore >= 75', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 7 }, (_, i) =>
        makeSummary({ date: `2025-01-0${i + 1}`, productivityScore: 75 + i })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('seven_day_focus')
    })

    it('does NOT unlock with 6 qualifying days + 1 failing day', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = [
        makeSummary({ date: '2025-01-07', productivityScore: 74 }), // fails
        ...Array.from({ length: 6 }, (_, i) =>
          makeSummary({ date: `2025-01-0${i + 1}`, productivityScore: 80 })
        ),
      ]
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('seven_day_focus')
    })

    it('does NOT unlock when fewer than 7 summaries exist', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', productivityScore: 100 }),
        makeSummary({ date: '2025-01-02', productivityScore: 100 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('seven_day_focus')
    })
  })

  // ── healthy_week ────────────────────────────────────────────────────────

  describe('healthy_week', () => {
    it('unlocks when all 7 days have healthScore >= 80', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 7 }, (_, i) =>
        makeSummary({ date: `2025-01-0${i + 1}`, healthScore: 80 })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('healthy_week')
    })

    it('does NOT unlock when one day has healthScore < 80', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = [
        makeSummary({ date: '2025-01-07', healthScore: 79 }),
        ...Array.from({ length: 6 }, (_, i) =>
          makeSummary({ date: `2025-01-0${i + 1}`, healthScore: 85 })
        ),
      ]
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('healthy_week')
    })
  })

  // ── balanced_day ────────────────────────────────────────────────────────

  describe('balanced_day', () => {
    it('unlocks when any single day has all three scores >= 70', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', healthScore: 70, productivityScore: 70, learningScore: 70 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('balanced_day')
    })

    it('does NOT unlock when one of the three scores is below 70', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        // healthScore is 69
        makeSummary({ date: '2025-01-01', healthScore: 69, productivityScore: 70, learningScore: 70 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('balanced_day')
    })

    it('does NOT unlock when all three are exactly 70 on no single day together', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        // Day 1: productivity missing
        makeSummary({ date: '2025-01-01', healthScore: 90, productivityScore: 60, learningScore: 90 }),
        // Day 2: learning missing
        makeSummary({ date: '2025-01-02', healthScore: 90, productivityScore: 90, learningScore: 60 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('balanced_day')
    })
  })

  // ── digital_minimalist ──────────────────────────────────────────────────

  describe('digital_minimalist', () => {
    it('unlocks when entertainment < 30 min on each of the last 5 days', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 5 }, (_, i) =>
        makeSummary({
          date: `2025-01-0${i + 1}`,
          byCategory: { entertainment: 29 * 60 }, // 29 minutes = under threshold
        })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('digital_minimalist')
    })

    it('does NOT unlock when one day has entertainment >= 30 min', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = [
        makeSummary({ date: '2025-01-05', byCategory: { entertainment: 30 * 60 } }), // exactly 30 min = fails
        ...Array.from({ length: 4 }, (_, i) =>
          makeSummary({ date: `2025-01-0${i + 1}`, byCategory: { entertainment: 0 } })
        ),
      ]
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('digital_minimalist')
    })

    it('does NOT unlock when fewer than 5 summaries exist', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', byCategory: { entertainment: 0 } }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('digital_minimalist')
    })
  })

  // ── learning_streak ─────────────────────────────────────────────────────

  describe('learning_streak', () => {
    it('unlocks when learning or programming > 0 on each of the last 7 days', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 7 }, (_, i) =>
        makeSummary({
          date: `2025-01-0${i + 1}`,
          byCategory: { learning: 100, programming: 0 },
        })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('learning_streak')
    })

    it('unlocks when programming > 0 covers the requirement', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 7 }, (_, i) =>
        makeSummary({
          date: `2025-01-0${i + 1}`,
          byCategory: { learning: 0, programming: 500 },
        })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('learning_streak')
    })

    it('does NOT unlock when one day has no learning or programming', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = [
        makeSummary({ date: '2025-01-07', byCategory: { learning: 0, programming: 0 } }), // gap
        ...Array.from({ length: 6 }, (_, i) =>
          makeSummary({ date: `2025-01-0${i + 1}`, byCategory: { learning: 200 } })
        ),
      ]
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('learning_streak')
    })
  })

  // ── eye_care_champion ───────────────────────────────────────────────────

  describe('eye_care_champion', () => {
    it('unlocks when breaks >= 3 on each of the last 3 days', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = Array.from({ length: 3 }, (_, i) =>
        makeSummary({ date: `2025-01-0${i + 1}`, breaks: 3 })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toContain('eye_care_champion')
    })

    it('does NOT unlock when one day has fewer than 3 breaks', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      const days = [
        makeSummary({ date: '2025-01-03', breaks: 2 }), // fails
        makeSummary({ date: '2025-01-02', breaks: 5 }),
        makeSummary({ date: '2025-01-01', breaks: 4 }),
      ]
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).not.toContain('eye_care_champion')
    })
  })

  // ── Deduplication ───────────────────────────────────────────────────────

  describe('deduplication', () => {
    it('does NOT duplicate already-unlocked achievements on re-evaluation', async () => {
      const existing: Achievement[] = [
        { id: 'deep_learner', unlockedAt: 1000, seen: true },
      ]
      mockGetSettings.mockResolvedValue(makeSettings(existing))
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', learningScore: 95 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      // Should not appear in NEW unlocks
      expect(unlocked).not.toContain('deep_learner')

      // Should not duplicate in persisted list
      const savedAchievements = mockUpdateSettings.mock.calls[0]?.[0]?.achievements as Achievement[]
      const deepLearnerEntries = savedAchievements?.filter(a => a.id === 'deep_learner')
      expect(deepLearnerEntries).toHaveLength(1)
    })

    it('returns only NEWLY unlocked ids', async () => {
      const existing: Achievement[] = [
        { id: 'deep_learner', unlockedAt: 1000, seen: false },
      ]
      mockGetSettings.mockResolvedValue(makeSettings(existing))
      // 7 days with productivityScore >= 75 AND learningScore >= 90
      const days = Array.from({ length: 7 }, (_, i) =>
        makeSummary({
          date: `2025-01-0${i + 1}`,
          productivityScore: 80,
          learningScore: 95,
          healthScore: 85,
        })
      )
      mockGetLastNDailySummaries.mockResolvedValue(days)

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      // deep_learner was already unlocked, should NOT appear in new unlocks
      expect(unlocked).not.toContain('deep_learner')
      // But seven_day_focus should be newly unlocked
      expect(unlocked).toContain('seven_day_focus')
    })
  })

  // ── Persistence ─────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('calls updateSettings with merged achievements list', async () => {
      const existing: Achievement[] = [
        { id: 'deep_learner', unlockedAt: 1000, seen: true },
      ]
      mockGetSettings.mockResolvedValue(makeSettings(existing))
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', breaks: 5 }),
        makeSummary({ date: '2024-12-31', breaks: 4 }),
        makeSummary({ date: '2024-12-30', breaks: 3 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      await engine.evaluate()

      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          achievements: expect.arrayContaining([
            expect.objectContaining({ id: 'deep_learner' }),
          ]),
        })
      )
    })

    it('new Achievement entries have seen: false and a numeric unlockedAt', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', learningScore: 95 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      await engine.evaluate()

      const saved = mockUpdateSettings.mock.calls[0]?.[0]?.achievements as Achievement[]
      const entry = saved?.find(a => a.id === 'deep_learner')
      expect(entry).toBeDefined()
      expect(entry?.seen).toBe(false)
      expect(typeof entry?.unlockedAt).toBe('number')
      expect(entry?.unlockedAt).toBeGreaterThan(0)
    })
  })

  // ── Empty result ─────────────────────────────────────────────────────────

  describe('empty result', () => {
    it('returns empty array when no achievements are earned', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([
        makeSummary({ date: '2025-01-01', learningScore: 0, healthScore: 0, productivityScore: 0 }),
      ])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      const unlocked = await engine.evaluate()

      expect(unlocked).toEqual([])
    })

    it('still calls updateSettings even when no new achievements', async () => {
      mockGetSettings.mockResolvedValue(makeSettings())
      mockGetLastNDailySummaries.mockResolvedValue([])

      const { AchievementsEngine } = await import('./AchievementsEngine')
      const engine = new AchievementsEngine()
      await engine.evaluate()

      expect(mockUpdateSettings).toHaveBeenCalled()
    })
  })
})
