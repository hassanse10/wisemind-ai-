import { TrackingEngine } from './TrackingEngine'
import { ClassifierEngine } from './ClassifierEngine'
import { CoachingEngine } from './CoachingEngine'
import { ScoringEngine } from './ScoringEngine'
import { AchievementsEngine } from './AchievementsEngine'
import { NotificationManager } from './NotificationManager'
import { getSettings, updateSettings, isPrivateMode } from '../shared/StorageManager'
import { addShortVideoSession, addCoachingEvent, getVisitsByDateRange } from '../shared/db'
import { getTodayRange } from '../shared/constants'
import type { CoachingEvent, ShortVideoPlatform } from '../shared/types'

// ─── Engine instances ─────────────────────────────────────────────────────
// Instantiated at module level so they survive service worker restarts.
// init() is called here — ONLY here, never again inside onInstalled.

const tracking = new TrackingEngine()
const classifier = new ClassifierEngine()
const coaching = new CoachingEngine()
const scoring = new ScoringEngine()
const achievements = new AchievementsEngine()

tracking.init()
classifier.init()
coaching.init()

// Track last activity signal timestamp to support continuousMinutes tracking
let lastActivityTime = Date.now()

// computeScores fires every 5 minutes to keep scores fresh
chrome.alarms.create('computeScores', { periodInMinutes: 5 })

// Compute once on startup so the popup/side panel show real data immediately
// instead of zeros until the first 5-minute alarm fires.
void recomputeAndBroadcast()

// Debounced recompute so a burst of events (e.g. scrolling many Shorts) only
// triggers one recompute, giving the open popup/side panel near-live feedback
// without waiting for the 5-minute alarm.
let recomputeTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRecompute(): void {
  if (recomputeTimer) return
  recomputeTimer = setTimeout(() => {
    recomputeTimer = null
    void recomputeAndBroadcast()
  }, 1500)
}

async function recomputeAndBroadcast(): Promise<void> {
  const scores = await scoring.computeAndStore()
  chrome.runtime.sendMessage({ type: 'SCORE_UPDATE', payload: scores }).catch(() => {})
}

// ─── One-time setup on install / update ───────────────────────────────────
// No engine init() calls here — only first-run configuration.

chrome.runtime.onInstalled.addListener(() => {
  // Schedule the daily summary alarm at next midnight, repeating every 24 h
  chrome.alarms.create('dailySummary', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60,
  })

  // Idle detection threshold: 5 minutes (300 seconds)
  chrome.idle.setDetectionInterval(300)

  // Side panel: do not open automatically on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
})

// ─── Alarm routing ────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === 'classifyBatch') {
    await classifier.runBatch()
  }

  if (alarm.name === 'computeScores') {
    const scores = await scoring.computeAndStore()
    chrome.runtime.sendMessage({ type: 'SCORE_UPDATE', payload: scores }).catch(() => {})
  }

  if (alarm.name === 'coachingTick') {
    const message = await coaching.evaluateRules()
    if (message) {
      await NotificationManager.deliver(message)
    }
    const scores = await scoring.computeAndStore()
    chrome.runtime.sendMessage({ type: 'SCORE_UPDATE', payload: scores }).catch(() => {})
  }

  if (alarm.name === 'dailySummary') {
    await scoring.computeAndStore()
    const unlocked = await achievements.evaluate()
    if (unlocked.length > 0) {
      chrome.runtime.sendMessage({ type: 'ACHIEVEMENT_UNLOCKED', payload: { ids: unlocked } }).catch(() => {})
    }
  }

  if (alarm.name === 'ytBadge') {
    await updateYouTubeBadge()
  }
})

// ─── Message routing ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (message.type === 'GET_SETTINGS') {
      getSettings().then(sendResponse)
      return true // keep the message channel open for the async response
    }

    if (message.type === 'SHORT_WATCHED') {
      const payload = message.payload as { platform: import('../shared/types').ShortVideoPlatform; count: number; duration: number }
      void (async () => {
        if (await isPrivateMode()) return
        const now = Date.now()
        await addShortVideoSession({
          id: crypto.randomUUID(),
          platform: payload.platform,
          startTime: now,
          endTime: now,
          count: payload.count,
          duration: payload.duration,
        })
        // Refresh scores/summary so the open popup or side panel reflects the
        // new short within ~1.5s instead of waiting for the 5-minute alarm.
        scheduleRecompute()
      })()
      return false
    }

    if (message.type === 'COACHING_RESPONSE') {
      const payload = message.payload as { response: 'continue' | 'take_break' | 'dismissed'; mood: string | null }
      void addCoachingEvent({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'mindful_checkin',
        message: '',
        userResponse: payload.response as CoachingEvent['userResponse'],
        mood: payload.mood as CoachingEvent['mood'],
      })
      return false
    }

    if (message.type === 'ACTIVITY_SIGNAL') {
      const payload = message.payload as { scrollIntensity: number; videoPlaying: boolean; hasFocus: boolean; timestamp: number }
      lastActivityTime = payload.timestamp
      return false
    }
  }
)

// ─── Short-video detection (background, no content script needed) ──────────
// YouTube Shorts and Instagram Reels change the URL to a new video id as you
// scroll, via the History API. webNavigation fires for those in the always-
// wakeable service worker, so we detect Shorts here instead of relying on a
// content script being injected. Deduped per tab by video id.

const lastShortIdByTab = new Map<number, string>()

function shortFromUrl(url: string): { platform: ShortVideoPlatform; id: string } | null {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('youtube.com')) {
      const m = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      if (m) return { platform: 'youtube_shorts', id: m[1] }
    } else if (u.hostname.includes('instagram.com')) {
      const m = u.pathname.match(/^\/reels?\/([^/?#]+)/)
      if (m) return { platform: 'instagram_reels', id: m[1] }
    }
  } catch {
    // ignore malformed URLs
  }
  return null
}

async function handleShortNavigation(tabId: number, url: string): Promise<void> {
  const hit = shortFromUrl(url)
  if (!hit) return
  if (lastShortIdByTab.get(tabId) === hit.id) return // same short, don't recount
  lastShortIdByTab.set(tabId, hit.id)
  if (await isPrivateMode()) return
  const now = Date.now()
  await addShortVideoSession({
    id: crypto.randomUUID(),
    platform: hit.platform,
    startTime: now,
    endTime: now,
    count: 1,
    duration: 0,
  })
  scheduleRecompute()
}

chrome.webNavigation.onHistoryStateUpdated.addListener(d => {
  if (d.frameId === 0) void handleShortNavigation(d.tabId, d.url)
})
chrome.webNavigation.onCompleted.addListener(d => {
  if (d.frameId === 0) void handleShortNavigation(d.tabId, d.url)
})
chrome.tabs.onRemoved.addListener(tabId => lastShortIdByTab.delete(tabId))

// ─── YouTube time badge ────────────────────────────────────────────────────
// Show today's time spent on YouTube as a badge on the toolbar icon. Today's
// committed visits come from the DB (survives service-worker restarts) and the
// current, not-yet-committed view is added live via ytSegmentStart so the badge
// ticks up while watching.

let ytSegmentStart: number | null = null

function isYouTube(url: string | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).hostname.endsWith('youtube.com')
  } catch {
    return false
  }
}

function badgeText(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  if (m < 1) return ''
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h${rem}` // e.g. "9m", "1h", "1h20"
}

async function updateYouTubeBadge(): Promise<void> {
  const { start, end } = getTodayRange()
  const visits = await getVisitsByDateRange(start, end)
  let seconds = visits
    .filter(v => v.domain === 'youtube.com' || v.domain.endsWith('.youtube.com'))
    .reduce((sum, v) => sum + v.duration, 0)
  if (ytSegmentStart !== null) seconds += Math.round((Date.now() - ytSegmentStart) / 1000)

  const text = badgeText(seconds)
  try {
    await chrome.action.setBadgeText({ text })
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: '#fb7185' })
      chrome.action.setBadgeTextColor?.({ color: '#ffffff' })
    }
  } catch {
    // action API momentarily unavailable — ignore
  }
}

// Restart the live segment whenever the active tab / focused window changes or a
// top-level navigation completes, so it always measures the current YouTube view.
async function syncYouTubeSegment(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  ytSegmentStart = isYouTube(tab?.url) ? Date.now() : null
  await updateYouTubeBadge()
}

chrome.tabs.onActivated.addListener(() => void syncYouTubeSegment())
chrome.windows.onFocusChanged.addListener(() => void syncYouTubeSegment())
chrome.webNavigation.onCompleted.addListener(d => {
  if (d.frameId === 0) void syncYouTubeSegment()
})
chrome.alarms.create('ytBadge', { periodInMinutes: 1 })
void syncYouTubeSegment()

// ─── Break detection via idle ─────────────────────────────────────────────
// When the user goes idle during waking hours, count it as a break.

chrome.idle.onStateChanged.addListener(async (state: string) => {
  if (state === 'idle') {
    const hour = new Date().getHours()
    // Only count breaks between 6 am and 11 pm
    if (hour >= 6 && hour < 23) {
      const settings = await getSettings()
      if (settings.todaysSummary) {
        await updateSettings({
          todaysSummary: {
            ...settings.todaysSummary,
            breaks: settings.todaysSummary.breaks + 1,
          },
        })
      }
    }
  }

  // A break (idle or locked screen) ends the continuous browsing session
  if (state === 'idle' || state === 'locked') {
    coaching.resetSession()
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────

function getNextMidnight(): number {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 1, 0, 0)
  return tomorrow.getTime()
}
