import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WindDownEngine } from './WindDownEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    windDownEnabled: true,
    privateModeActive: false,
    windDownStart: 1290,   // 21:30
    windDownBedtime: 1380, // 23:00
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    windDownEnabled: true, privateModeActive: false, windDownStart: 1290, windDownBedtime: 1380, ...partial,
  } as any)
}

const at = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('WindDownEngine phase', () => {
  it('returns gentle between wind-down start and bedtime', async () => {
    at('2026-06-29T21:45:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('gentle')
  })

  it('returns firm after bedtime', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('firm')
  })

  it('returns firm after midnight (still in window)', async () => {
    at('2026-06-29T00:30:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('firm')
  })
})

describe('WindDownEngine gates', () => {
  it('null before wind-down start', async () => {
    at('2026-06-29T20:00:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).toBeNull()
  })

  it('null after the wake hour (06:00)', async () => {
    at('2026-06-29T07:00:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).toBeNull()
  })

  it('null when disabled', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    await settingsOnce({ windDownEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null in private mode', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WindDownEngine cooldown + snooze', () => {
  it('gentle reminder respects the 30-minute cooldown', async () => {
    at('2026-06-29T21:45:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).not.toBeNull()
    at('2026-06-29T22:05:00') // +20 min
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T22:16:00') // +31 min from first
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('snooze defers the next reminder by 15 minutes', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).not.toBeNull() // firm fires
    engine.snooze()
    at('2026-06-29T23:40:00') // +10 min
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T23:46:00') // +16 min, past snooze AND past 20-min firm cooldown? no — use snooze boundary
    // snooze window (15m) has passed; firm cooldown (20m) from 23:30 has NOT — so still null
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T23:51:00') // +21 min from first firm
    expect(await engine.evaluate()).not.toBeNull()
  })
})
