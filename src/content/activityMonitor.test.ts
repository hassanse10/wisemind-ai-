import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('activityMonitor', () => {
  it('sends ACTIVITY_SIGNAL every 30 seconds', async () => {
    await import('./activityMonitor')
    vi.advanceTimersByTime(30_000)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACTIVITY_SIGNAL' })
    )
    expect(sendMessage).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(30_000)
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })
})
