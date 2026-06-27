import { getLastNDailySummaries } from '../shared/db'
import { getSettings, updateSettings } from '../shared/StorageManager'
import type { Achievement, DailySummary } from '../shared/types'

// ─── Achievement evaluation helpers ──────────────────────────────────────────

/** Returns true if any summary in the list satisfies the predicate. */
function any(summaries: DailySummary[], pred: (s: DailySummary) => boolean): boolean {
  return summaries.some(pred)
}

/** Returns true if ALL summaries in the list satisfy the predicate AND the list
 *  has at least `minRequired` entries. */
function all(summaries: DailySummary[], minRequired: number, pred: (s: DailySummary) => boolean): boolean {
  return summaries.length >= minRequired && summaries.every(pred)
}

// ─── Achievement condition definitions ────────────────────────────────────────
// Each entry maps an achievement id to an evaluator that receives the last-7
// summaries (already sorted date-descending from getLastNDailySummaries).

type Evaluator = (summaries: DailySummary[]) => boolean

const ACHIEVEMENT_EVALUATORS: Record<string, Evaluator> = {
  /** Any single day with learningScore >= 90. */
  deep_learner: (summaries) =>
    any(summaries, (s) => s.learningScore >= 90),

  /** productivityScore >= 75 on each of the last 7 days. */
  seven_day_focus: (summaries) =>
    all(summaries.slice(0, 7), 7, (s) => s.productivityScore >= 75),

  /** healthScore >= 80 on each of the last 7 days. */
  healthy_week: (summaries) =>
    all(summaries.slice(0, 7), 7, (s) => s.healthScore >= 80),

  /** Any single day with all three scores >= 70. */
  balanced_day: (summaries) =>
    any(
      summaries,
      (s) => s.healthScore >= 70 && s.productivityScore >= 70 && s.learningScore >= 70
    ),

  /** byCategory.entertainment (seconds) < 30 min on each of the last 5 days. */
  digital_minimalist: (summaries) =>
    all(summaries.slice(0, 5), 5, (s) => (s.byCategory.entertainment ?? 0) < 30 * 60),

  /** (learning + programming) > 0 on each of the last 7 days. */
  learning_streak: (summaries) =>
    all(
      summaries.slice(0, 7),
      7,
      (s) => (s.byCategory.learning ?? 0) + (s.byCategory.programming ?? 0) > 0
    ),

  /**
   * Eye-care proxy: breaks >= 3 on each of the last 3 days.
   *
   * NOTE: `breaks` counts idle-state transitions detected by the background
   * service worker (see idle.onStateChanged handler in index.ts). This is a
   * best-effort approximation — a "break" here means the OS went idle for at
   * least 5 minutes, not that the user took a deliberate eye-rest. It is a
   * reasonable signal that the user stepped away from the screen regularly.
   */
  eye_care_champion: (summaries) =>
    all(summaries.slice(0, 3), 3, (s) => s.breaks >= 3),
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class AchievementsEngine {
  /**
   * Evaluates all achievements, unlocks any newly-earned ones (that aren't
   * already in settings.achievements), persists the merged list via
   * updateSettings, and returns the list of NEWLY unlocked achievement ids.
   */
  async evaluate(): Promise<string[]> {
    const [settings, summaries] = await Promise.all([
      getSettings(),
      getLastNDailySummaries(7),
    ])

    const existing = settings.achievements ?? []
    const alreadyUnlocked = new Set(existing.map((a) => a.id))

    const newlyUnlocked: Achievement[] = []
    const now = Date.now()

    for (const [id, evaluator] of Object.entries(ACHIEVEMENT_EVALUATORS)) {
      if (alreadyUnlocked.has(id)) continue
      if (evaluator(summaries)) {
        newlyUnlocked.push({ id, unlockedAt: now, seen: false })
      }
    }

    const merged = [...existing, ...newlyUnlocked]
    await updateSettings({ achievements: merged })

    return newlyUnlocked.map((a) => a.id)
  }
}
