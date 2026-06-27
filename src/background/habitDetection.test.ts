import { describe, it, expect } from 'vitest'
import { detectSuppressedRules } from './habitDetection'
import type { DailySummary } from '../shared/types'

// Helper to build a minimal DailySummary for a given date
function makeSummary(date: string, shortVideoCount: number, lateNightMinutes: number): DailySummary {
  return {
    date,
    totalTime: 3600,
    byCategory: {} as DailySummary['byCategory'],
    shortVideoCount,
    shortVideoDuration: 0,
    healthScore: 80,
    productivityScore: 70,
    learningScore: 60,
    breaks: 2,
    lateNightMinutes,
    topSites: [],
  }
}

describe('detectSuppressedRules', () => {
  it('returns [] when fewer than 7 summaries are provided (even if all show heavy shorts)', () => {
    const summaries: DailySummary[] = [
      makeSummary('2026-06-20', 100, 30),
      makeSummary('2026-06-21', 100, 30),
      makeSummary('2026-06-22', 100, 30),
      makeSummary('2026-06-23', 100, 30),
      makeSummary('2026-06-24', 100, 30),
      makeSummary('2026-06-25', 100, 30),
      // Only 6 summaries — suppression should NOT kick in
    ]
    // Remove one to test with 6
    summaries.pop()
    expect(detectSuppressedRules(summaries)).toEqual([])
  })

  it('returns [] with exactly 6 summaries (boundary check)', () => {
    const summaries = [
      makeSummary('2026-06-20', 100, 30),
      makeSummary('2026-06-21', 100, 30),
      makeSummary('2026-06-22', 100, 30),
      makeSummary('2026-06-23', 100, 30),
      makeSummary('2026-06-24', 100, 30),
      makeSummary('2026-06-25', 100, 30),
    ]
    expect(detectSuppressedRules(summaries)).toEqual([])
  })

  it('suppresses shorts_overload when >=5 of the last 7 days have shortVideoCount > 50', () => {
    // 5 days with >50, 2 days without
    const summaries = [
      makeSummary('2026-06-19', 55, 0),
      makeSummary('2026-06-20', 55, 0),
      makeSummary('2026-06-21', 55, 0),
      makeSummary('2026-06-22', 55, 0),
      makeSummary('2026-06-23', 55, 0),
      makeSummary('2026-06-24', 10, 0), // under threshold
      makeSummary('2026-06-25', 10, 0), // under threshold
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).toContain('shorts_overload')
    expect(result).not.toContain('late_night')
  })

  it('does NOT suppress shorts_overload when only 4 of 7 days exceed 50 shorts', () => {
    const summaries = [
      makeSummary('2026-06-19', 55, 0),
      makeSummary('2026-06-20', 55, 0),
      makeSummary('2026-06-21', 55, 0),
      makeSummary('2026-06-22', 55, 0),
      makeSummary('2026-06-23', 10, 0), // under threshold
      makeSummary('2026-06-24', 10, 0), // under threshold
      makeSummary('2026-06-25', 10, 0), // under threshold
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).not.toContain('shorts_overload')
  })

  it('suppresses late_night when >=5 of last 7 days have lateNightMinutes >= 20', () => {
    const summaries = [
      makeSummary('2026-06-19', 0, 25),
      makeSummary('2026-06-20', 0, 20), // exactly at threshold — counts
      makeSummary('2026-06-21', 0, 30),
      makeSummary('2026-06-22', 0, 45),
      makeSummary('2026-06-23', 0, 22),
      makeSummary('2026-06-24', 0, 5),  // below threshold
      makeSummary('2026-06-25', 0, 0),  // below threshold
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).toContain('late_night')
    expect(result).not.toContain('shorts_overload')
  })

  it('returns both suppressed rules when both patterns hold', () => {
    const summaries = [
      makeSummary('2026-06-19', 60, 25),
      makeSummary('2026-06-20', 70, 30),
      makeSummary('2026-06-21', 80, 40),
      makeSummary('2026-06-22', 90, 20),
      makeSummary('2026-06-23', 51, 35),
      makeSummary('2026-06-24', 5, 5),
      makeSummary('2026-06-25', 3, 0),
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).toContain('shorts_overload')
    expect(result).toContain('late_night')
  })

  it('returns [] when neither pattern holds', () => {
    const summaries = [
      makeSummary('2026-06-19', 10, 5),
      makeSummary('2026-06-20', 20, 10),
      makeSummary('2026-06-21', 5, 0),
      makeSummary('2026-06-22', 30, 15),
      makeSummary('2026-06-23', 15, 8),
      makeSummary('2026-06-24', 40, 12),
      makeSummary('2026-06-25', 50, 19), // exactly 50 is NOT > 50, and 19 < 20
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).toEqual([])
  })

  it('uses the most recent 7 by date when more than 7 summaries are passed', () => {
    // Older days (8-14 days ago) all show heavy shorts/late night — should NOT count
    // Recent 7 days: only 3 have heavy shorts (< 5 threshold) — should NOT suppress
    const summaries = [
      // Old days — would trigger suppression if counted
      makeSummary('2026-06-10', 100, 60),
      makeSummary('2026-06-11', 100, 60),
      makeSummary('2026-06-12', 100, 60),
      makeSummary('2026-06-13', 100, 60),
      makeSummary('2026-06-14', 100, 60),
      // Recent 7 days — only 3 have heavy shorts
      makeSummary('2026-06-19', 60, 30),
      makeSummary('2026-06-20', 60, 30),
      makeSummary('2026-06-21', 60, 30),
      makeSummary('2026-06-22', 5, 5),
      makeSummary('2026-06-23', 5, 5),
      makeSummary('2026-06-24', 5, 5),
      makeSummary('2026-06-25', 5, 5),
    ]
    // Most recent 7: 2026-06-19 through 2026-06-25, 3 of 7 exceed thresholds — no suppression
    const result = detectSuppressedRules(summaries)
    expect(result).not.toContain('shorts_overload')
    expect(result).not.toContain('late_night')
  })

  it('suppresses based on most recent 7 when more than 7 summaries are passed', () => {
    // Old days: low usage; Recent 7 days: 5+ high usage — suppression kicks in
    const summaries = [
      // Old days
      makeSummary('2026-06-10', 5, 0),
      makeSummary('2026-06-11', 5, 0),
      makeSummary('2026-06-12', 5, 0),
      // Recent 7 days — 5 with heavy shorts
      makeSummary('2026-06-19', 60, 5),
      makeSummary('2026-06-20', 70, 5),
      makeSummary('2026-06-21', 80, 5),
      makeSummary('2026-06-22', 90, 5),
      makeSummary('2026-06-23', 55, 5),
      makeSummary('2026-06-24', 10, 5),
      makeSummary('2026-06-25', 10, 5),
    ]
    const result = detectSuppressedRules(summaries)
    expect(result).toContain('shorts_overload')
    expect(result).not.toContain('late_night')
  })
})
