let scrollIntensity = 0

// Passive listener so wheel handling never blocks scrolling.
document.addEventListener(
  'wheel',
  e => {
    scrollIntensity = Math.min(10, scrollIntensity + Math.abs(e.deltaY) / 100)
  },
  { passive: true }
)

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scrollIntensity = 0
})

// videoPlaying is only needed once every 30s when we emit a signal, so we
// compute it on demand instead of tracking every <video> with listeners and a
// MutationObserver. The old observer re-scanned the whole DOM on every
// mutation, which made heavy SPAs like YouTube janky, and its Set of <video>
// elements leaked detached nodes. Computing lazily is cheap and leak-free.
function isVideoPlaying(): boolean {
  for (const v of document.querySelectorAll('video')) {
    if (!v.paused && !v.ended && v.readyState > 2) return true
  }
  return false
}

// Guard against duplicate interval if the module is ever re-executed.
let intervalStarted = false
if (!intervalStarted) {
  intervalStarted = true
  const timer = setInterval(() => {
    // After the extension is reloaded/updated, this orphaned content script
    // loses its context; `chrome.runtime.id` goes undefined and sendMessage
    // throws "Extension context invalidated". Stop instead of spamming errors.
    if (!chrome.runtime?.id) {
      clearInterval(timer)
      return
    }
    try {
      chrome.runtime.sendMessage({
        type: 'ACTIVITY_SIGNAL',
        payload: {
          scrollIntensity: Math.round(scrollIntensity),
          videoPlaying: isVideoPlaying(),
          hasFocus: !document.hidden,
          timestamp: Date.now(),
        },
      })
    } catch {
      clearInterval(timer)
      return
    }
    scrollIntensity = Math.max(0, scrollIntensity - 1) // decay
  }, 30_000)
}

export {}
