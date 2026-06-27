import type { DailySummary } from '../shared/types'

/**
 * Returns the rule ids whose triggering behaviour has become an established
 * daily habit, so the coach should stop firing them (nagging is not helping).
 * Only acts once there are at least 7 days of history (per spec). Maps each
 * habit-detectable rule to a metric on DailySummary:
 *  - 'shorts_overload': user exceeded 50 short videos on >= 5 of the last 7 days
 *  - 'late_night':      lateNightMinutes >= 20 on >= 5 of the last 7 days
 */
export function detectSuppressedRules(summaries: DailySummary[]): string[] {
  if (summaries.length < 7) return []

  // Sort by date descending and take the most recent 7
  const recent = [...summaries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)

  const suppressed: string[] = []

  const shortsOverloadDays = recent.filter(s => s.shortVideoCount > 50).length
  if (shortsOverloadDays >= 5) {
    suppressed.push('shorts_overload')
  }

  const lateNightDays = recent.filter(s => s.lateNightMinutes >= 20).length
  if (lateNightDays >= 5) {
    suppressed.push('late_night')
  }

  return suppressed
}
