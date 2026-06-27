import { sendMessage } from '../shared/messaging'

let scrollIntensity = 0
let videoPlaying = false

document.addEventListener('wheel', e => {
  scrollIntensity = Math.min(10, scrollIntensity + Math.abs(e.deltaY) / 100)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scrollIntensity = 0
})

const videos = document.querySelectorAll('video')
videos.forEach(v => {
  v.addEventListener('play', () => { videoPlaying = true })
  v.addEventListener('pause', () => { videoPlaying = false })
})

// Also observe dynamically added videos
const observer = new MutationObserver(() => {
  document.querySelectorAll('video').forEach(v => {
    v.addEventListener('play', () => { videoPlaying = true })
    v.addEventListener('pause', () => { videoPlaying = false })
  })
})
observer.observe(document.body, { childList: true, subtree: true })

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
