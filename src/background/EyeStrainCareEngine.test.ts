import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EyeStrainCareEngine, EYE_STRAIN_STEPS } from './EyeStrainCareEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    eyeStrainCareEnabled: true,
    privateModeActive: false,
    eyeStrainCareIntervalMinutes: 30,
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    eyeStrainCareEnabled: true, privateModeActive: false, eyeStrainCareIntervalMinutes: 30, ...partial,
  } as any)
}

const NOON = new Date('2026-07-02T12:00:00')
const min = (n: number) => n * 60_000

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('EyeStrainCareEngine interval', () => {
  it('fires once the interval elapses', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    const steps = await engine.evaluate()
    expect(steps).not.toBeNull()
    expect(steps).toEqual(EYE_STRAIN_STEPS)
  })

  it('does not fire before the interval', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(29)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('EyeStrainCareEngine gates', () => {
  it('returns null when disabled', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    await settingsOnce({ eyeStrainCareEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null in private mode', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null outside waking hours (before 6am)', async () => {
    vi.setSystemTime(new Date('2026-07-02T02:00:00'))
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-07-02T02:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('EyeStrainCareEngine responses + rotation', () => {
  it('complete() restarts the interval', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.complete()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('skip() restarts the interval with no immediate re-fire', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.skip()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('resetSession() restarts the interval (idle/locked)', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(20)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(51)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('always returns all 4 steps in the fixed order, every time it fires', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    const first = await engine.evaluate()
    expect(first?.map(s => s.id)).toEqual(['blink', 'look_away', 'posture', 'brightness'])
    engine.complete()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    const second = await engine.evaluate()
    expect(second?.map(s => s.id)).toEqual(['blink', 'look_away', 'posture', 'brightness'])
  })
})
