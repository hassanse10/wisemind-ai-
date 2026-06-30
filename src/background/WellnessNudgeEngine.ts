import { getSettings } from '../shared/StorageManager'

const WAKE_START = 6
const WAKE_END = 23

// Ordered so rotation alternates posture and hydration.
export const NUDGES = [
  'Roll your shoulders back and sit up tall.',
  'Take a few sips of water.',
  'Unclench your jaw and relax your shoulders.',
  'Hydrate — have some water.',
  'Feet flat, back supported — reset your posture.',
  'Time for a water break — stay hydrated.',
]

/**
 * Deterministic, AI-free posture/hydration reminder. Fires a rotating nudge on a
 * fixed interval while the user is present (the streak resets on idle/locked).
 * State is in-memory; a service-worker restart costs at most one delayed nudge.
 */
export class WellnessNudgeEngine {
  private lastNudgeAt = Date.now()
  private index = 0

  init(): void {
    chrome.alarms.create('wellnessTick', { periodInMinutes: 1 })
    this.lastNudgeAt = Date.now()
  }

  resetSession(): void {
    this.lastNudgeAt = Date.now()
  }

  async evaluate(): Promise<string | null> {
    const settings = await getSettings()
    if (!settings.wellnessNudgesEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (now - this.lastNudgeAt < settings.wellnessNudgeIntervalMinutes * 60_000) return null

    const message = NUDGES[this.index % NUDGES.length]
    this.index++
    this.lastNudgeAt = now
    return message
  }
}
