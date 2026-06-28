import type { ShortVideoPlatform } from '../shared/types'

let sessionStart = Date.now()

function fireShortWatched(platform: ShortVideoPlatform): void {
  chrome.runtime.sendMessage({
    type: 'SHORT_WATCHED',
    payload: { platform, count: 1, duration: Math.round((Date.now() - sessionStart) / 1000) },
  })
  sessionStart = Date.now()
}

// --- YouTube Shorts ---
// YouTube swaps the URL between Shorts on scroll using BOTH pushState and
// replaceState (and sometimes only an internal nav event). We can't rely on a
// single navigation hook, so we detect by comparing the current short video id
// against the last one we counted. Each distinct id counts exactly once.
let lastYouTubeShortId: string | null = null

function youTubeShortId(): string | null {
  const match = window.location.pathname.match(/^\/shorts\/([^/?#]+)/)
  return match ? match[1] : null
}

export function detectYouTubeShorts(): void {
  const id = youTubeShortId()
  if (id && id !== lastYouTubeShortId) {
    lastYouTubeShortId = id
    fireShortWatched('youtube_shorts')
  }
}

export function detectTikTok(): void {
  fireShortWatched('tiktok')
}

// Patch both history methods so any SPA navigation re-checks the URL.
type HistoryFn = (data: unknown, unused: string, url?: string | URL | null) => void
function patch(name: 'pushState' | 'replaceState'): void {
  const original = history[name].bind(history) as HistoryFn
  history[name] = function (data: unknown, unused: string, url?: string | URL | null) {
    original(data, unused, url)
    setTimeout(detectYouTubeShorts, 300)
  } as History[typeof name]
}
patch('pushState')
patch('replaceState')
window.addEventListener('popstate', () => setTimeout(detectYouTubeShorts, 300))
// YouTube's SPA dispatches this when a navigation finishes.
window.addEventListener('yt-navigate-finish', () => setTimeout(detectYouTubeShorts, 300))

// Belt-and-suspenders: poll the URL on YouTube, since Shorts scrolling does not
// always emit a navigation event the page exposes to extensions. The id-dedup
// makes this safe — it never double-counts the same short.
if (window.location.hostname.includes('youtube.com')) {
  setInterval(detectYouTubeShorts, 1000)
}

detectYouTubeShorts()

// --- TikTok: observe video container for new videos ---
if (window.location.hostname.includes('tiktok.com')) {
  const observer = new MutationObserver(() => detectTikTok())
  const container = document.querySelector('[class*="DivVideoFeedV2"]') ?? document.body
  observer.observe(container, { childList: true })
}

// --- Instagram Reels ---
if (window.location.hostname.includes('instagram.com')) {
  const observer = new MutationObserver(() => {
    if (window.location.pathname.startsWith('/reels')) {
      fireShortWatched('instagram_reels')
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// --- Facebook Reels ---
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
