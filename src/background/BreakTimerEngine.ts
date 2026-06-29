import { getSettings } from '../shared/StorageManager'

export interface BreakPrompt {
  id: string
  title: string
  instruction: string
  durationSec: number
}

// Rotating set of guided active breaks. Order is significant (tests assert it).
export const BREAK_PROMPTS: BreakPrompt[] = [
  { id: 'eye_reset', title: 'Rest your eyes', instruction: 'Look at something about 20 feet away and let your eyes relax.', durationSec: 20 },
  { id: 'stand_stretch', title: 'Stand & stretch', instruction: 'Stand up and roll your shoulders slowly back.', durationSec: 30 },
  { id: 'walk_water', title: 'Move a little', instruction: 'Take a short walk or grab a glass of water.', durationSec: 60 },
  { id: 'neck_loosen', title: 'Loosen your neck', instruction: 'Roll your neck gently in slow circles, each direction.', durationSec: 30 },
]

const SNOOZE_MS = 5 * 60_000
const WAKE_START = 6  // inclusive hour
const WAKE_END = 23   // exclusive hour

/**
 * Deterministic, AI-free break reminder timer. Tracks the continuous-use streak
 * and decides when the next guided break is due. State is in-memory; a service
 * worker restart resets the streak (≈ a break), which is acceptable.
 */
export class BreakTimerEngine {
  private lastBreakAt = Date.now()
  private overrideNextAt = 0   // when > 0, supersedes the interval (snooze)
  private promptIndex = 0

  init(): void {
    chrome.alarms.create('breakTimerTick', { periodInMinutes: 1 })
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** Called when the user goes idle/locked — the streak resets. */
  resetSession(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** Decide whether to show a prompt now. Mutates state only when it returns one. */
  async evaluate(): Promise<BreakPrompt | null> {
    const settings = await getSettings()
    if (!settings.eyeHealthReminders) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (this.overrideNextAt === 0 && now < this.lastBreakAt + settings.breakIntervalMinutes * 60_000) return null
    if (this.overrideNextAt > 0 && now < this.overrideNextAt) return null

    const prompt = BREAK_PROMPTS[this.promptIndex % BREAK_PROMPTS.length]
    this.promptIndex++
    this.lastBreakAt = now
    this.overrideNextAt = 0
    return prompt
  }

  /** User finished the guided break — restart the streak. */
  completeBreak(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** User snoozed — re-prompt in 5 minutes regardless of the interval. */
  snooze(): void {
    this.overrideNextAt = Date.now() + SNOOZE_MS
  }

  /** User skipped — no break credit; wait a full interval before re-prompting. */
  skip(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }
}
