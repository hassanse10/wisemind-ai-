import { TrackingEngine } from './TrackingEngine'
import { ClassifierEngine } from './ClassifierEngine'
import { CoachingEngine } from './CoachingEngine'
import { ScoringEngine } from './ScoringEngine'
import { NotificationManager } from './NotificationManager'
import { getSettings, updateSettings } from '../shared/StorageManager'

// ─── Engine instances ─────────────────────────────────────────────────────
// Instantiated at module level so they survive service worker restarts.
// init() is called here — ONLY here, never again inside onInstalled.

const tracking = new TrackingEngine()
const classifier = new ClassifierEngine()
const coaching = new CoachingEngine()
const scoring = new ScoringEngine()

tracking.init()
classifier.init()
coaching.init()

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
    await scoring.computeAndStore()
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
  }
})

// ─── Message routing ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    if (message.type === 'GET_SETTINGS') {
      getSettings().then(sendResponse)
      return true // keep the message channel open for the async response
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
})

// ─── Helpers ──────────────────────────────────────────────────────────────

function getNextMidnight(): number {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 1, 0, 0)
  return tomorrow.getTime()
}
