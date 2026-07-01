import type { DailySummary } from '../shared/types'

export type MetricKey = 'lateNight' | 'breaks' | 'screenTime' | 'health'
export type TrendDirection = 'up' | 'down' | 'flat'

export interface MetricTrend {
  key: MetricKey
  label: string
  values: number[]       // per-day, oldest→newest; raw units
  average: number
  direction: TrendDirection
  goodWhenDown: boolean
}

export interface HealthTrends {
  days: number
  metrics: MetricTrend[]
  best: { date: string; score: number } | null
  worst: { date: string; score: number } | null
}

interface MetricDef {
  key: MetricKey
  label: string
  goodWhenDown: boolean
  pick: (s: DailySummary) => number
}

const METRICS: MetricDef[] = [
  { key: 'lateNight', label: 'Late-night', goodWhenDown: true, pick: s => s.lateNightMinutes },
  { key: 'breaks', label: 'Breaks/day', goodWhenDown: false, pick: s => s.breaks },
  { key: 'screenTime', label: 'Screen time', goodWhenDown: true, pick: s => s.totalTime },
  { key: 'health', label: 'Health score', goodWhenDown: false, pick: s => s.healthScore },
]

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function trendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'flat'
  const older = values.slice(0, Math.floor(values.length / 2))
  const recent = values.slice(Math.ceil(values.length / 2))
  if (older.length === 0 || recent.length === 0) return 'flat'
  const o = mean(older)
  const r = mean(recent)
  const epsilon = Math.max(1, o * 0.05)
  if (r - o > epsilon) return 'up'
  if (o - r > epsilon) return 'down'
  return 'flat'
}

export function computeHealthTrends(summaries: DailySummary[]): HealthTrends {
  const window = [...summaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)

  const metrics: MetricTrend[] = METRICS.map(m => {
    const values = window.map(m.pick)
    return {
      key: m.key,
      label: m.label,
      values,
      average: Math.round(mean(values)),
      direction: trendDirection(values),
      goodWhenDown: m.goodWhenDown,
    }
  })

  let best: { date: string; score: number } | null = null
  let worst: { date: string; score: number } | null = null
  for (const s of window) {
    if (best === null || s.healthScore > best.score) best = { date: s.date, score: s.healthScore }
    if (worst === null || s.healthScore < worst.score) worst = { date: s.date, score: s.healthScore }
  }

  return { days: window.length, metrics, best, worst }
}
