import { describe, it, expect } from 'vitest'
import { ScoringEngine } from './ScoringEngine'
import type { Visit, ShortVideoSession, ExtensionSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/StorageManager'

const makeVisit = (category: Visit['category'], duration: number): Visit => ({
  id: 'v', url: '', domain: '', title: '', startTime: 0, endTime: 0,
  duration, category, aiCategory: '', classified: true,
})

const settings: ExtensionSettings = { ...DEFAULT_SETTINGS }

describe('ScoringEngine.computeHealthScore', () => {
  const engine = new ScoringEngine()

  it('returns 100 for a perfect day (30+ min learning, ≤2h entertainment, 3+ breaks, no late night)', () => {
    const visits: Visit[] = [
      makeVisit('learning', 2000),
      makeVisit('entertainment', 3000),
    ]
    const score = engine['computeHealthScore'](visits, [], 3, 0, settings)
    expect(score).toBe(100)
  })

  it('deducts for entertainment over 2 hours', () => {
    const visits: Visit[] = [
      makeVisit('learning', 2000),
      makeVisit('entertainment', 8000),
    ]
    const score = engine['computeHealthScore'](visits, [], 3, 0, settings)
    expect(score).toBeLessThan(100)
  })

  it('deducts for late-night usage', () => {
    const visits: Visit[] = [makeVisit('learning', 2000)]
    const score = engine['computeHealthScore'](visits, [], 3, 15, settings)
    expect(score).toBeLessThan(100)
  })
})

describe('ScoringEngine.computeProductivityScore', () => {
  const engine = new ScoringEngine()

  it('returns high score for all productive time', () => {
    const visits: Visit[] = [
      makeVisit('programming', 3600),
      makeVisit('learning', 1800),
    ]
    const score = engine['computeProductivityScore'](visits, [], 0)
    expect(score).toBeGreaterThan(80)
  })

  it('penalises heavy short-video consumption', () => {
    const visits: Visit[] = [makeVisit('entertainment', 3600)]
    const scoreLight = engine['computeProductivityScore'](visits, [], 10)
    const scoreHeavy = engine['computeProductivityScore'](visits, [], 40)
    expect(scoreHeavy).toBeLessThan(scoreLight)
  })
})

describe('ScoringEngine.computeLearningScore', () => {
  const engine = new ScoringEngine()

  it('scales with learning minutes up to 70 pts at 60 min', () => {
    const visits60 = [makeVisit('learning', 3600)]
    const visits30 = [makeVisit('learning', 1800)]
    const score60 = engine['computeLearningScore'](visits60, false)
    const score30 = engine['computeLearningScore'](visits30, false)
    expect(score60).toBeGreaterThan(score30)
    expect(score60).toBeGreaterThanOrEqual(70)
  })
})
