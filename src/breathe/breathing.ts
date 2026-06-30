export interface BreathPhase {
  label: string
  seconds: number
}

// Box breathing: inhale, hold, exhale, hold — each 4 seconds.
export const BOX_PATTERN: BreathPhase[] = [
  { label: 'Breathe in', seconds: 4 },
  { label: 'Hold', seconds: 4 },
  { label: 'Breathe out', seconds: 4 },
  { label: 'Hold', seconds: 4 },
]
export const TOTAL_CYCLES = 4

const CYCLE_SECONDS = BOX_PATTERN.reduce((sum, p) => sum + p.seconds, 0) // 16
const TOTAL_SECONDS = CYCLE_SECONDS * TOTAL_CYCLES // 64
const SCALE_MIN = 0.5
const SCALE_MAX = 1

export interface BreathingState {
  cycle: number       // 1-based, capped at TOTAL_CYCLES
  phaseIndex: number  // 0..3
  phaseLabel: string
  scale: number       // SCALE_MIN..SCALE_MAX
  done: boolean
}

/**
 * Pure mapping from elapsed seconds to the current box-breathing state. The
 * circle scale grows during inhale, holds large, shrinks during exhale, holds
 * small. Clamps to the resting "done" state once the session completes.
 */
export function breathingState(elapsedSec: number): BreathingState {
  if (elapsedSec >= TOTAL_SECONDS) {
    return { cycle: TOTAL_CYCLES, phaseIndex: 3, phaseLabel: BOX_PATTERN[3].label, scale: SCALE_MIN, done: true }
  }

  const clamped = Math.max(0, elapsedSec)
  const cycle = Math.floor(clamped / CYCLE_SECONDS) + 1

  let within = clamped % CYCLE_SECONDS
  let phaseIndex = 0
  for (let i = 0; i < BOX_PATTERN.length; i++) {
    if (within < BOX_PATTERN[i].seconds) {
      phaseIndex = i
      break
    }
    within -= BOX_PATTERN[i].seconds
  }

  const progress = within / BOX_PATTERN[phaseIndex].seconds // 0..1 into the phase
  let scale: number
  switch (phaseIndex) {
    case 0: scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * progress; break // inhale: grow
    case 1: scale = SCALE_MAX; break                                      // hold: large
    case 2: scale = SCALE_MAX - (SCALE_MAX - SCALE_MIN) * progress; break // exhale: shrink
    default: scale = SCALE_MIN; break                                     // hold: small
  }

  return { cycle, phaseIndex, phaseLabel: BOX_PATTERN[phaseIndex].label, scale, done: false }
}
