import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WellnessNudgeEngine, NUDGES } from './WellnessNudgeEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    wellnessNudgesEnabled: true,
    privateModeActive: false,
    wellnessNudgeIntervalMinutes: 40,
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    wellnessNudgesEnabled: true, privateModeActive: false, wellnessNudgeIntervalMinutes: 40, ...partial,
  } as any)
}

const NOON = new Date('2026-06-30T12:00:00')
const min = (n: number) => n * 60_000

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('WellnessNudgeEngine interval', () => {
  it('fires once the interval elapses', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('does not fire before the interval', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(39)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WellnessNudgeEngine gates', () => {
  it('null when disabled', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    await settingsOnce({ wellnessNudgesEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null in private mode', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null outside waking hours (3am)', async () => {
    vi.setSystemTime(new Date('2026-06-30T03:00:00'))
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-06-30T03:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WellnessNudgeEngine session + rotation', () => {
  it('resetSession restarts the interval', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(60)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(71)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('rotates through NUDGES and wraps', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    const seen: string[] = []
    for (let i = 1; i <= NUDGES.length + 1; i++) {
      vi.setSystemTime(new Date(NOON.getTime() + min(40 * i)))
      const m = await engine.evaluate()
      seen.push(m!)
    }
    expect(seen.slice(0, NUDGES.length)).toEqual(NUDGES)
    expect(seen[NUDGES.length]).toBe(NUDGES[0])
  })
})
