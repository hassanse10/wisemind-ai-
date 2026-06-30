import { describe, it, expect } from 'vitest'
import { breathingState, BOX_PATTERN, TOTAL_CYCLES } from './breathing'

describe('breathingState', () => {
  it('starts in cycle 1, breathing in, at min scale', () => {
    const s = breathingState(0)
    expect(s.cycle).toBe(1)
    expect(s.phaseIndex).toBe(0)
    expect(s.phaseLabel).toBe('Breathe in')
    expect(s.scale).toBeCloseTo(0.5)
    expect(s.done).toBe(false)
  })

  it('grows the scale mid-inhale', () => {
    const s = breathingState(2) // halfway through the 4s inhale
    expect(s.phaseLabel).toBe('Breathe in')
    expect(s.scale).toBeCloseTo(0.75)
  })

  it('holds large after inhale', () => {
    const s = breathingState(4)
    expect(s.phaseIndex).toBe(1)
    expect(s.phaseLabel).toBe('Hold')
    expect(s.scale).toBeCloseTo(1)
  })

  it('shrinks during exhale', () => {
    const s = breathingState(10) // 2s into the exhale phase (phase starts at 8s)
    expect(s.phaseIndex).toBe(2)
    expect(s.phaseLabel).toBe('Breathe out')
    expect(s.scale).toBeCloseTo(0.75)
  })

  it('holds small after exhale', () => {
    const s = breathingState(12)
    expect(s.phaseIndex).toBe(3)
    expect(s.phaseLabel).toBe('Hold')
    expect(s.scale).toBeCloseTo(0.5)
  })

  it('advances to cycle 2 at 16s', () => {
    const s = breathingState(16)
    expect(s.cycle).toBe(2)
    expect(s.phaseIndex).toBe(0)
    expect(s.phaseLabel).toBe('Breathe in')
  })

  it('is done at/after the total duration', () => {
    expect(breathingState(64).done).toBe(true)
    expect(breathingState(64).cycle).toBe(TOTAL_CYCLES)
    expect(breathingState(100).done).toBe(true)
  })

  it('has the expected pattern shape', () => {
    expect(BOX_PATTERN.map(p => p.label)).toEqual(['Breathe in', 'Hold', 'Breathe out', 'Hold'])
    expect(BOX_PATTERN.every(p => p.seconds === 4)).toBe(true)
    expect(TOTAL_CYCLES).toBe(4)
  })
})
