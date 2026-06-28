import type { ShortVideoPlatform } from '../shared/types'

// YouTube Shorts and Instagram Reels are detected in the background service
// worker via webNavigation (they change the URL per video), so this content
// script only handles TikTok and Facebook, whose feeds do not reliably change
// the URL per video and so need DOM observation.

let sessionStart = Date.now()

function fireShortWatched(platform: ShortVideoPlatform): void {
  chrome.runtime.sendMessage({
    type: 'SHORT_WATCHED',
    payload: { platform, count: 1, duration: Math.round((Date.now() - sessionStart) / 1000) },
  })
  sessionStart = Date.now()
}

export function detectTikTok(): void {
  fireShortWatched('tiktok')
}

// TikTok: observe the video feed container for newly mounted videos.
if (window.location.hostname.includes('tiktok.com')) {
  const observer = new MutationObserver(() => detectTikTok())
  const container = document.querySelector('[class*="DivVideoFeedV2"]') ?? document.body
  observer.observe(container, { childList: true })
}

// Facebook Reels: observe for reel containers being mounted.
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
