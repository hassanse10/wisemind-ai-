import { getSettings } from '../shared/StorageManager'

export interface EyeStrainStep {
  id: string
  title: string
  instruction: string
  durationSec: number
}

// Fixed sequence covering the four real causes of digital eye strain. Always
// shown in full, in this order — not rotating, not partial.
export const EYE_STRAIN_STEPS: EyeStrainStep[] = [
  { id: 'blink', title: 'Blink', instruction: 'Blink slowly and fully, ten times.', durationSec: 10 },
  { id: 'look_away', title: 'Look away', instruction: 'Look at something at least 20 feet away.', durationSec: 20 },
  { id: 'posture', title: 'Check your posture', instruction: "Sit up straight, screen at eye level, about an arm's length away.", durationSec: 15 },
  { id: 'brightness', title: 'Check your brightness', instruction: 'Match your screen brightness to the room around you.', durationSec: 10 },
]

const WAKE_START = 6  // inclusive hour
const WAKE_END = 23   // exclusive hour

/**
 * Deterministic, AI-free eye-strain-care timer. Independent of BreakTimerEngine
 * — both may fire; they address different things. State is in-memory; a
 * service-worker restart resets the streak (at worst one delayed prompt).
 */
export class EyeStrainCareEngine {
  private lastFiredAt = Date.now()

  init(): void {
    chrome.alarms.create('eyeStrainTick', { periodInMinutes: 1 })
    this.lastFiredAt = Date.now()
  }

  /** Called when the user goes idle/locked — the streak resets. */
  resetSession(): void {
    this.lastFiredAt = Date.now()
  }

  /** Decide whether to show the walkthrough now. Mutates state only when it returns steps. */
  async evaluate(): Promise<EyeStrainStep[] | null> {
    const settings = await getSettings()
    if (!settings.eyeStrainCareEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (now < this.lastFiredAt + settings.eyeStrainCareIntervalMinutes * 60_000) return null

    this.lastFiredAt = now
    return EYE_STRAIN_STEPS
  }

  /** User finished the full walkthrough — restart the interval. */
  complete(): void {
    this.lastFiredAt = Date.now()
  }

  /** User skipped — no break credit; wait a full interval before re-prompting. */
  skip(): void {
    this.lastFiredAt = Date.now()
  }
}
