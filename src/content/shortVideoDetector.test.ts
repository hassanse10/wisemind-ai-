import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'
import { detectYouTubeShorts, detectTikTok } from './shortVideoDetector'

beforeEach(() => vi.clearAllMocks())

describe('detectYouTubeShorts', () => {
  it('sends SHORT_WATCHED when URL contains /shorts/', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/abc123', pathname: '/shorts/abc123' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHORT_WATCHED',
      payload: expect.objectContaining({ platform: 'youtube_shorts', count: 1 }),
    })
  })

  it('does not send when URL is not /shorts/', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/watch?v=abc', pathname: '/watch' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})

describe('detectTikTok', () => {
  it('sends SHORT_WATCHED with platform tiktok', () => {
    detectTikTok()
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHORT_WATCHED',
      payload: expect.objectContaining({ platform: 'tiktok', count: 1 }),
    })
  })
})
