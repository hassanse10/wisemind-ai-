import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('activityMonitor', () => {
  it('sends ACTIVITY_SIGNAL every 30 seconds', async () => {
    await import('./activityMonitor')
    vi.advanceTimersByTime(30_000)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACTIVITY_SIGNAL' })
    )
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(30_000)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })
})
