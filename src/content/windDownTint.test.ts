import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('windDownTintOpacity', () => {
  it('is 0 when disabled', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1350, 1290, 1380, false)).toBe(0)
  })

  it('is 0 before wind-down start', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1200, 1290, 1380, true)).toBe(0) // 20:00
  })

  it('ramps partially mid-evening', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    // halfway between 21:30 and 23:00 = 22:15 → ~0.15
    const o = windDownTintOpacity(1335, 1290, 1380, true)
    expect(o).toBeGreaterThan(0.13)
    expect(o).toBeLessThan(0.17)
  })

  it('holds max at/after bedtime', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1380, 1290, 1380, true)).toBe(0.3) // 23:00
    expect(windDownTintOpacity(1400, 1290, 1380, true)).toBe(0.3) // 23:20
  })

  it('holds max after midnight, before wake hour', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(120, 1290, 1380, true)).toBe(0.3) // 02:00
  })

  it('is 0 at/after the wake hour', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(360, 1290, 1380, true)).toBe(0) // 06:00
    expect(windDownTintOpacity(420, 1290, 1380, true)).toBe(0) // 07:00
  })
})
