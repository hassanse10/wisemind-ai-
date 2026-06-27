import type { Visit, ShortVideoSession, Scores, ExtensionSettings } from '../shared/types'
import { PRODUCTIVE_CATEGORIES, getTodayRange, getDateString } from '../shared/constants'
import { getVisitsByDateRange, getShortVideosByDateRange, putDailySummary, getLastNDailySummaries } from '../shared/db'
import { getSettings, updateSettings } from '../shared/StorageManager'

export class ScoringEngine {
  async computeAndStore(): Promise<Scores> {
    const { start, end } = getTodayRange()
    const [visits, shortVideos, settings] = await Promise.all([
      getVisitsByDateRange(start, end),
      getShortVideosByDateRange(start, end),
      getSettings(),
    ])

    const lateNightMinutes = visits
      .filter(v => { const h = new Date(v.startTime).getHours(); return h >= 23 || h < 6 })
      .reduce((s, v) => s + v.duration / 60, 0)

    const breakCount = await this.getBreakCount()

    const health = this.computeHealthScore(visits, shortVideos, breakCount, lateNightMinutes, settings)
    const shortVideoCount = shortVideos.reduce((s, sv) => s + sv.count, 0)
    const productivity = this.computeProductivityScore(visits, shortVideos, shortVideoCount)
    const learningStreak = await this.getLearningStreak()
    const learning = this.computeLearningScore(visits, learningStreak >= 7)

    const scores: Scores = { health, productivity, learning }

    const byCategory = {} as Record<string, number>
    for (const v of visits) {
      byCategory[v.category] = (byCategory[v.category] ?? 0) + v.duration
    }

    const topSites = Object.entries(
      visits.reduce((acc, v) => {
        acc[v.domain] = (acc[v.domain] ?? 0) + v.duration
        return acc
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, duration]) => ({ domain, duration }))

    const date = getDateString()

    const todaysSummary = {
      date,
      totalTime: visits.reduce((s, v) => s + v.duration, 0),
      byCategory: byCategory as any,
      shortVideoCount,
      shortVideoDuration: shortVideos.reduce((s, sv) => s + sv.duration, 0),
      healthScore: health,
      productivityScore: productivity,
      learningScore: learning,
      breaks: breakCount,
      lateNightMinutes: Math.round(lateNightMinutes),
      topSites,
    }

    await putDailySummary(todaysSummary)

    await updateSettings({
      lastHealthScore: health,
      todaysSummary,
    })

    return scores
  }

  private async getBreakCount(): Promise<number> {
    const { todaysSummary } = await getSettings()
    return todaysSummary?.breaks ?? 0
  }

  private async getLearningStreak(): Promise<number> {
    const summaries = await getLastNDailySummaries(8)
    const today = getDateString()
    let streak = 0
    for (const s of summaries) {
      if (s.date === today) continue
      const cat = s.byCategory as any
      if ((cat['learning'] ?? 0) > 0 || (cat['programming'] ?? 0) > 0) {
        streak++
      } else {
        break
      }
    }
    return streak
  }

  private computeHealthScore(
    visits: Visit[],
    _shortVideos: ShortVideoSession[],
    breakCount: number,
    lateNightMinutes: number,
    _settings: ExtensionSettings
  ): number {
    let score = 100

    // Sleep dimension (20 pts): deduct 2 per 10 min of late-night usage
    const sleepDeduction = Math.min(20, Math.floor(lateNightMinutes / 10) * 2)
    score -= sleepDeduction

    // Learning dimension (20 pts): scale from 0 (0 min) to full 20 pts at 30+ min
    const learningSeconds = visits
      .filter(v => v.category === 'learning' || v.category === 'programming') // programming counts as productive-learning for health; reading is tracked separately in computeLearningScore
      .reduce((s, v) => s + v.duration, 0)
    const learningMinutes = learningSeconds / 60
    if (learningMinutes < 30) {
      score -= Math.round((1 - learningMinutes / 30) * 20)
    }

    // Entertainment dimension (20 pts): deduct 3 per 30 min over 2h cap
    // Any overage counts as at least one interval (ceil ensures partial intervals penalise)
    const entertainmentMinutes =
      visits
        .filter(v => v.category === 'entertainment')
        .reduce((s, v) => s + v.duration, 0) / 60
    if (entertainmentMinutes > 120) {
      score -= Math.min(20, Math.ceil((entertainmentMinutes - 120) / 30) * 3)
    }

    // Breaks dimension (20 pts): deduct 5 per missed break below 3
    if (breakCount < 3) {
      score -= (3 - breakCount) * 5
    }

    return Math.max(0, Math.min(100, score))
  }

  private computeProductivityScore(
    visits: Visit[],
    _shortVideos: ShortVideoSession[],
    shortVideoCount: number
  ): number {
    const total = visits.reduce((s, v) => s + v.duration, 0)
    if (total === 0) return 0

    const productive = visits
      .filter(v => PRODUCTIVE_CATEGORIES.includes(v.category))
      .reduce((s, v) => s + v.duration, 0)

    const base = Math.round((productive / total) * 100)
    let score = base
    if (shortVideoCount > 30) score -= 10
    return Math.max(0, Math.min(100, score))
  }

  private computeLearningScore(visits: Visit[], hasLearningStreak: boolean): number {
    const learningSeconds = visits
      .filter(v => ['learning', 'programming', 'reading'].includes(v.category))
      .reduce((s, v) => s + v.duration, 0)
    const learningMinutes = learningSeconds / 60

    let score = Math.round(Math.min(learningMinutes / 60, 1) * 70)
    if (hasLearningStreak) score += 15
    return Math.max(0, Math.min(100, score))
  }
}
