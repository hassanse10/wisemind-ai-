import { sendMessage } from '../shared/messaging'

let scrollIntensity = 0
let videoPlaying = false

document.addEventListener('wheel', e => {
  scrollIntensity = Math.min(10, scrollIntensity + Math.abs(e.deltaY) / 100)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scrollIntensity = 0
})

// Fix 1: Track attached videos to prevent duplicate listeners
const attachedVideos = new Set<HTMLVideoElement>()

function attachVideoListeners() {
  document.querySelectorAll('video').forEach(v => {
    if (!attachedVideos.has(v)) {
      attachedVideos.add(v)
      v.addEventListener('play', () => { videoPlaying = true })
      v.addEventListener('pause', () => { videoPlaying = false })
    }
  })
}

// Attach listeners to videos present at init time
attachVideoListeners()

// Also observe dynamically added videos
const observer = new MutationObserver(() => attachVideoListeners())
observer.observe(document.body, { childList: true, subtree: true })

// Fix 2: Guard against duplicate interval if module is re-executed
let intervalStarted = false
if (!intervalStarted) {
  intervalStarted = true
  setInterval(() => {
    sendMessage({
      type: 'ACTIVITY_SIGNAL',
      payload: {
        scrollIntensity: Math.round(scrollIntensity),
        videoPlaying,
        hasFocus: !document.hidden,
        timestamp: Date.now(),
      },
    })
    scrollIntensity = Math.max(0, scrollIntensity - 1) // decay
  }, 30_000)
}
