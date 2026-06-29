import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BreakTimerEngine, BREAK_PROMPTS } from './BreakTimerEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    eyeHealthReminders: true,
    privateModeActive: false,
    breakIntervalMinutes: 45,
  }),
}))

const NOON = new Date('2026-06-29T12:00:00')
const min = (n: number) => n * 60_000

async function mockSettingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    eyeHealthReminders: true, privateModeActive: false, breakIntervalMinutes: 45, ...partial,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('BreakTimerEngine interval', () => {
  it('fires once the interval has elapsed', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('does not fire before the interval', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(44)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('BreakTimerEngine gates', () => {
  it('returns null when disabled (eyeHealthReminders false)', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    await mockSettingsOnce({ eyeHealthReminders: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null in private mode', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    await mockSettingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null outside waking hours (before 6am)', async () => {
    vi.setSystemTime(new Date('2026-06-29T02:00:00'))
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-06-29T02:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('BreakTimerEngine responses', () => {
  it('snooze re-prompts after 5 minutes regardless of interval', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.snooze()
    vi.setSystemTime(new Date(NOON.getTime() + min(47)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('skip waits a full interval and gives no immediate re-prompt', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.skip()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(90)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('completeBreak restarts the streak', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.completeBreak()
    vi.setSystemTime(new Date(NOON.getTime() + min(80)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(90)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('resetSession restarts the streak (idle/locked)', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(70)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(75)))
    expect(await engine.evaluate()).not.toBeNull()
  })
})

describe('BreakTimerEngine rotation', () => {
  it('rotates through all prompts then wraps', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    const ids: string[] = []
    for (let i = 1; i <= BREAK_PROMPTS.length + 1; i++) {
      vi.setSystemTime(new Date(NOON.getTime() + min(45 * i)))
      const p = await engine.evaluate()
      ids.push(p!.id)
    }
    expect(ids.slice(0, BREAK_PROMPTS.length)).toEqual(BREAK_PROMPTS.map(p => p.id))
    expect(ids[BREAK_PROMPTS.length]).toBe(BREAK_PROMPTS[0].id)
  })
})
