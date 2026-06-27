import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrackingEngine } from './TrackingEngine'

vi.mock('../shared/db', () => ({ addVisit: vi.fn() }))
vi.mock('../shared/StorageManager', () => ({
  isPrivateMode: vi.fn().mockResolvedValue(false),
  isDomainExcluded: vi.fn().mockResolvedValue(false),
}))

import { addVisit } from '../shared/db'
import { isPrivateMode } from '../shared/StorageManager'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrackingEngine.endSession', () => {
  it('discards sessions shorter than 5 seconds', async () => {
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 3000,
    }
    await engine['endSession']()
    expect(addVisit).not.toHaveBeenCalled()
  })

  it('saves sessions 5+ seconds to IndexedDB', async () => {
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 10000,
    }
    await engine['endSession']()
    expect(addVisit).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'github.com',
      duration: expect.any(Number),
    }))
  })

  it('skips saving when private mode is active', async () => {
    vi.mocked(isPrivateMode).mockResolvedValueOnce(true)
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 10000,
    }
    await engine['endSession']()
    expect(addVisit).not.toHaveBeenCalled()
  })
})
