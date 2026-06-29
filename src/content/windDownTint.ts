// Self-contained content script — no imports (must stay dependency-free so the
// build output has no ES import statements). The window math is intentionally
// duplicated from WindDownEngine; a shared import would become a chunk a content
// script cannot load.
const WAKE_HOUR = 6
const TINT_MAX = 0.3
const TINT_ID = 'wisemind-winddown-tint'

export function windDownTintOpacity(
  nowMin: number,
  startMin: number,
  bedtimeMin: number,
  enabled: boolean
): number {
  if (!enabled) return 0
  const wake = WAKE_HOUR * 60
  const inWindow = nowMin >= startMin || nowMin < wake
  if (!inWindow) return 0
  // minutes since wind-down start, accounting for the midnight wrap
  const sinceStart = nowMin >= startMin ? nowMin - startMin : nowMin + (1440 - startMin)
  const rampMinutes = bedtimeMin >= startMin ? bedtimeMin - startMin : bedtimeMin + (1440 - startMin)
  if (rampMinutes <= 0) return TINT_MAX
  const frac = Math.min(1, sinceStart / rampMinutes)
  return +(frac * TINT_MAX).toFixed(3)
}

function applyTint(opacity: number): void {
  let el = document.getElementById(TINT_ID) as HTMLDivElement | null
  if (opacity <= 0) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('div')
    el.id = TINT_ID
    el.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483646;' +
      'background:rgb(255,150,60);mix-blend-mode:multiply;transition:opacity 1s ease;'
    ;(document.documentElement || document.body)?.appendChild(el)
  }
  el.style.opacity = String(opacity)
}

function refresh(): void {
  if (!chrome.runtime?.id) return
  chrome.storage.local.get(
    { windDownTintEnabled: false, windDownStart: 1290, windDownBedtime: 1380 },
    (s: { windDownTintEnabled: boolean; windDownStart: number; windDownBedtime: number }) => {
      const d = new Date()
      const nowMin = d.getHours() * 60 + d.getMinutes()
      applyTint(windDownTintOpacity(nowMin, s.windDownStart, s.windDownBedtime, s.windDownTintEnabled))
    }
  )
}

refresh()
setInterval(refresh, 60_000)
chrome.storage.onChanged.addListener(refresh)
