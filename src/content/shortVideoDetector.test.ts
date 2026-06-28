import { describe, it, expect, vi, beforeEach } from 'vitest'

import { detectYouTubeShorts, detectTikTok } from './shortVideoDetector'

beforeEach(() => vi.clearAllMocks())

describe('detectYouTubeShorts', () => {
  it('sends SHORT_WATCHED when URL contains /shorts/', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/abc123', pathname: '/shorts/abc123' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
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
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('fires again when scrolling to a different short id', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/first1', pathname: '/shorts/first1' },
      writable: true,
    })
    detectYouTubeShorts()
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/second2', pathname: '/shorts/second2' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('does not double-count the same short id on repeated checks', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/samesame', pathname: '/shorts/samesame' },
      writable: true,
    })
    detectYouTubeShorts()
    detectYouTubeShorts()
    detectYouTubeShorts()
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('detectTikTok', () => {
  it('sends SHORT_WATCHED with platform tiktok', () => {
    detectTikTok()
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SHORT_WATCHED',
      payload: expect.objectContaining({ platform: 'tiktok', count: 1 }),
    })
  })
})
