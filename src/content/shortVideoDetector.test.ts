import { describe, it, expect, vi, beforeEach } from 'vitest'

import { detectTikTok } from './shortVideoDetector'

beforeEach(() => vi.clearAllMocks())

describe('detectTikTok', () => {
  it('sends SHORT_WATCHED with platform tiktok', () => {
    detectTikTok()
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SHORT_WATCHED',
      payload: expect.objectContaining({ platform: 'tiktok', count: 1 }),
    })
  })
})
