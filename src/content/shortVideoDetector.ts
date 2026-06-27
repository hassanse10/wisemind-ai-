import { sendMessage } from '../shared/messaging'
import type { ShortVideoPlatform } from '../shared/types'

let sessionStart = Date.now()

function fireShortWatched(platform: ShortVideoPlatform): void {
  sendMessage({
    type: 'SHORT_WATCHED',
    payload: { platform, count: 1, duration: Math.round((Date.now() - sessionStart) / 1000) },
  })
  sessionStart = Date.now()
}

export function detectYouTubeShorts(): void {
  if (window.location.pathname.startsWith('/shorts/')) {
    fireShortWatched('youtube_shorts')
  }
}

export function detectTikTok(): void {
  fireShortWatched('tiktok')
}

// YouTube: listen for pushState navigation
const originalPushState = history.pushState.bind(history)
history.pushState = function (...args) {
  originalPushState(...args)
  setTimeout(detectYouTubeShorts, 300)
}
window.addEventListener('popstate', () => setTimeout(detectYouTubeShorts, 300))
detectYouTubeShorts()

// TikTok: observe video container for new videos
if (window.location.hostname.includes('tiktok.com')) {
  const observer = new MutationObserver(() => detectTikTok())
  const container = document.querySelector('[class*="DivVideoFeedV2"]') ?? document.body
  observer.observe(container, { childList: true })
}

// Instagram Reels
if (window.location.hostname.includes('instagram.com')) {
  const observer = new MutationObserver(() => {
    if (window.location.pathname.startsWith('/reels')) {
      fireShortWatched('instagram_reels')
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// Facebook Reels
if (window.location.hostname.includes('facebook.com')) {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if ((node as Element)?.querySelector?.('[aria-label*="Reel"]')) {
          fireShortWatched('facebook_reels')
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
