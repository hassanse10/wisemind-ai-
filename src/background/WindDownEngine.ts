import { getSettings } from '../shared/StorageManager'

const WAKE_HOUR = 6
const GENTLE_COOLDOWN_MS = 30 * 60_000
const FIRM_COOLDOWN_MS = 20 * 60_000
const SNOOZE_MS = 15 * 60_000

const GENTLE_MESSAGES = [
  "It's past your wind-down time — start easing toward rest.",
  'Wind-down time. Consider dimming the lights and wrapping up soon.',
]
const FIRM_MESSAGES = [
  "It's past your bedtime. Screens now make it harder to fall asleep — consider stopping.",
  'Past bedtime. Your body rests better when the screens go off — time to stop.',
]

export function minutesOfDay(ts: number): number {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

// Night window is [startMin .. WAKE_HOUR*60), crossing midnight.
export function inNightWindow(nowMin: number, startMin: number): boolean {
  return nowMin >= startMin || nowMin < WAKE_HOUR * 60
}

// Called only within the night window. In the evening (now >= start), it is past
// bedtime once now >= bedtime; after midnight (now < start) it is always past.
export function pastBedtime(nowMin: number, startMin: number, bedtimeMin: number): boolean {
  if (nowMin >= startMin) return nowMin >= bedtimeMin
  return true
}

/**
 * Deterministic, AI-free bedtime reminder engine. Escalates from gentle (after
 * wind-down start) to firm (after bedtime), with per-phase cooldowns and snooze.
 * State is in-memory; a service-worker restart resets it (at worst one extra
 * reminder).
 */
export class WindDownEngine {
  private lastFiredAt = 0
  private snoozeUntil = 0
  private gentleIdx = 0
  private firmIdx = 0

  init(): void {
    chrome.alarms.create('windDownTick', { periodInMinutes: 1 })
    this.lastFiredAt = 0
    this.snoozeUntil = 0
  }

  async evaluate(): Promise<{ message: string; phase: 'gentle' | 'firm' } | null> {
    const settings = await getSettings()
    if (!settings.windDownEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const nowMin = minutesOfDay(now)
    if (!inNightWindow(nowMin, settings.windDownStart)) return null
    if (now < this.snoozeUntil) return null

    const firm = pastBedtime(nowMin, settings.windDownStart, settings.windDownBedtime)
    const cooldown = firm ? FIRM_COOLDOWN_MS : GENTLE_COOLDOWN_MS
    if (now - this.lastFiredAt < cooldown) return null

    this.lastFiredAt = now
    if (firm) {
      const message = FIRM_MESSAGES[this.firmIdx % FIRM_MESSAGES.length]
      this.firmIdx++
      return { message, phase: 'firm' }
    }
    const message = GENTLE_MESSAGES[this.gentleIdx % GENTLE_MESSAGES.length]
    this.gentleIdx++
    return { message, phase: 'gentle' }
  }

  snooze(): void {
    this.snoozeUntil = Date.now() + SNOOZE_MS
  }
}
