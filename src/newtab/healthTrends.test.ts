import { describe, it, expect } from 'vitest'
import { computeHealthTrends } from './healthTrends'
import type { DailySummary } from '../shared/types'

function makeSummary(
  date: string,
  o: { lateNightMinutes?: number; breaks?: number; totalTime?: number; healthScore?: number } = {}
): DailySummary {
  return {
    date,
    totalTime: o.totalTime ?? 0,
    byCategory: {} as DailySummary['byCategory'],
    shortVideoCount: 0,
    shortVideoDuration: 0,
    healthScore: o.healthScore ?? 0,
    productivityScore: 0,
    learningScore: 0,
    breaks: o.breaks ?? 0,
    lateNightMinutes: o.lateNightMinutes ?? 0,
    topSites: [],
  }
}

describe('computeHealthTrends', () => {
  it('extracts per-metric values oldest→newest and sorts by date', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-11', { lateNightMinutes: 30, breaks: 2, totalTime: 3600, healthScore: 60 }),
      makeSummary('2026-06-10', { lateNightMinutes: 10, breaks: 5, totalTime: 1800, healthScore: 90 }),
    ])
    const late = t.metrics.find(m => m.key === 'lateNight')!
    expect(late.values).toEqual([10, 30]) // 06-10 then 06-11
    expect(t.metrics.find(m => m.key === 'breaks')!.values).toEqual([5, 2])
    expect(t.metrics.find(m => m.key === 'screenTime')!.values).toEqual([1800, 3600])
    expect(t.metrics.find(m => m.key === 'health')!.values).toEqual([90, 60])
    expect(t.days).toBe(2)
  })

  it('averages each metric (rounded)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { breaks: 3 }),
      makeSummary('2026-06-11', { breaks: 4 }),
      makeSummary('2026-06-12', { breaks: 4 }),
    ])
    expect(t.metrics.find(m => m.key === 'breaks')!.average).toBe(4) // 11/3 = 3.67 → 4
  })

  it('reports the correct goodWhenDown flags', () => {
    const t = computeHealthTrends([makeSummary('2026-06-10'), makeSummary('2026-06-11')])
    const byKey = Object.fromEntries(t.metrics.map(m => [m.key, m.goodWhenDown]))
    expect(byKey).toEqual({ lateNight: true, breaks: false, screenTime: true, health: false })
  })

  it('detects an upward trend (recent half higher)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 50 }),
      makeSummary('2026-06-11', { healthScore: 52 }),
      makeSummary('2026-06-12', { healthScore: 80 }),
      makeSummary('2026-06-13', { healthScore: 84 }),
    ])
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('up')
  })

  it('detects a downward trend (recent half lower)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { lateNightMinutes: 60 }),
      makeSummary('2026-06-11', { lateNightMinutes: 58 }),
      makeSummary('2026-06-12', { lateNightMinutes: 10 }),
      makeSummary('2026-06-13', { lateNightMinutes: 8 }),
    ])
    expect(t.metrics.find(m => m.key === 'lateNight')!.direction).toBe('down')
  })

  it('reports flat when the halves are within epsilon', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 80 }),
      makeSummary('2026-06-11', { healthScore: 81 }),
      makeSummary('2026-06-12', { healthScore: 80 }),
      makeSummary('2026-06-13', { healthScore: 81 }),
    ])
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('flat')
  })

  it('picks best and worst by health score', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 70 }),
      makeSummary('2026-06-11', { healthScore: 92 }),
      makeSummary('2026-06-12', { healthScore: 55 }),
    ])
    expect(t.best).toEqual({ date: '2026-06-11', score: 92 })
    expect(t.worst).toEqual({ date: '2026-06-12', score: 55 })
  })

  it('keeps only the last 14 days', () => {
    const summaries = Array.from({ length: 20 }, (_, i) =>
      makeSummary(`2026-06-${String(i + 1).padStart(2, '0')}`, { breaks: i })
    )
    const t = computeHealthTrends(summaries)
    expect(t.days).toBe(14)
    expect(t.metrics.find(m => m.key === 'breaks')!.values.length).toBe(14)
    expect(t.metrics.find(m => m.key === 'breaks')!.values[13]).toBe(19) // newest day kept
  })

  it('handles empty input safely', () => {
    const t = computeHealthTrends([])
    expect(t.days).toBe(0)
    expect(t.best).toBeNull()
    expect(t.worst).toBeNull()
    expect(t.metrics.find(m => m.key === 'health')!.values).toEqual([])
    expect(t.metrics.find(m => m.key === 'health')!.average).toBe(0)
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('flat')
  })
})
