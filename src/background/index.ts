import { TrackingEngine } from './TrackingEngine'
import { ClassifierEngine } from './ClassifierEngine'
import { CoachingEngine } from './CoachingEngine'
import { ScoringEngine } from './ScoringEngine'
import { AchievementsEngine } from './AchievementsEngine'
import { NotificationManager } from './NotificationManager'
import { getSettings, updateSettings, isPrivateMode } from '../shared/StorageManager'
import { addShortVideoSession, addCoachingEvent } from '../shared/db'
import type { CoachingEvent } from '../shared/types'

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
