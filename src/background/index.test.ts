/**
 * Tests for the background service worker entry point (index.ts).
 *
 * Because index.ts has top-level side-effects (engine construction, init calls,
 * listener registration) we need to reset the module registry before each test
 * so the module re-executes fresh. We do this with vi.resetModules() + dynamic
 * import inside each test / beforeEach.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Shared mock state ────────────────────────────────────────────────────
// These are hoisted so vi.mock factories can reference them.

const mockTrackingInit = vi.fn()
const mockClassifierInit = vi.fn()
const mockClassifierRunBatch = vi.fn().mockResolvedValue(undefined)
const mockCoachingInit = vi.fn()
const mockCoachingEvaluateRules = vi.fn().mockResolvedValue(null)
const mockCoachingResetSession = vi.fn()
const mockScoringComputeAndStore = vi.fn().mockResolvedValue({ health: 80, productivity: 70, learning: 60 })
const mockAchievementsEvaluate = vi.fn().mockResolvedValue([])
const mockNotificationDeliver = vi.fn().mockResolvedValue(undefined)
const mockGetSettings = vi.fn().mockResolvedValue({
  openrouterApiKey: '',
  selectedModel: 'openai/gpt-4o-mini',
  mentorPersonality: 'wise',
  theme: 'system',
  coachingEnabled: true,
  coachingFrequency: 'moderate',
  coachingHours: { start: 9, end: 22 },
  excludedDomains: [],
  privateModeActive: false,
  eyeHealthReminders: true,
  lastHealthScore: 75,
  todaysSummary: null,
  achievements: [],
  ruleLastFired: {},
})
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined)
const mockIsPrivateMode = vi.fn().mockResolvedValue(false)
const mockAddShortVideoSession = vi.fn().mockResolvedValue(undefined)
const mockAddCoachingEvent = vi.fn().mockResolvedValue(undefined)

vi.mock('./TrackingEngine', () => ({
  TrackingEngine: vi.fn(function (this: Record<string, unknown>) {
    this.init = mockTrackingInit
  }),
}))

vi.mock('./ClassifierEngine', () => ({
  ClassifierEngine: vi.fn(function (this: Record<string, unknown>) {
    this.init = mockClassifierInit
    this.runBatch = mockClassifierRunBatch
  }),
}))

vi.mock('./CoachingEngine', () => ({
  CoachingEngine: vi.fn(function (this: Record<string, unknown>) {
    this.init = mockCoachingInit
    this.evaluateRules = mockCoachingEvaluateRules
    this.resetSession = mockCoachingResetSession
  }),
}))

vi.mock('./ScoringEngine', () => ({
  ScoringEngine: vi.fn(function (this: Record<string, unknown>) {
    this.computeAndStore = mockScoringComputeAndStore
  }),
}))

vi.mock('./AchievementsEngine', () => ({
  AchievementsEngine: vi.fn(function (this: Record<string, unknown>) {
    this.evaluate = mockAchievementsEvaluate
  }),
}))

vi.mock('./NotificationManager', () => ({
  NotificationManager: { deliver: mockNotificationDeliver },
}))

vi.mock('../shared/StorageManager', () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
  isPrivateMode: mockIsPrivateMode,
  DEFAULT_SETTINGS: {},
}))

vi.mock('../shared/db', () => ({
  addShortVideoSession: mockAddShortVideoSession,
  addCoachingEvent: mockAddCoachingEvent,
}))

// Helper: reset module cache + clear mocks, then re-import so top-level code reruns
async function freshImport() {
  vi.clearAllMocks()
  vi.resetModules()
  await import('./index')
}

// Helper: get the alarm listener registered by the module
function getAlarmListener() {
  const calls = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls
  if (calls.length === 0) throw new Error('No alarm listener registered')
  return calls[0][0] as (alarm: chrome.alarms.Alarm) => Promise<void>
}

// Helper: get the onMessage listener
function getMessageListener() {
  const calls = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
  if (calls.length === 0) throw new Error('No message listener registered')
  return calls[0][0] as (
    message: { type: string; payload?: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | undefined
}

// Helper: get onInstalled listener and trigger it
function triggerInstalled() {
  const calls = vi.mocked(chrome.runtime.onInstalled.addListener).mock.calls
  if (calls.length === 0) throw new Error('No onInstalled listener registered')
  const cb = calls[0][0] as (details: chrome.runtime.InstalledDetails) => void
  cb({ reason: 'install', previousVersion: undefined, id: undefined } as chrome.runtime.InstalledDetails)
}

// ─── Module-level wiring ───────────────────────────────────────────────────

describe('background/index — module-level engine initialisation', () => {
  beforeEach(freshImport)

  it('instantiates TrackingEngine and calls init()', () => {
    expect(mockTrackingInit).toHaveBeenCalledTimes(1)
  })

  it('instantiates ClassifierEngine and calls init()', () => {
    expect(mockClassifierInit).toHaveBeenCalledTimes(1)
  })

  it('instantiates CoachingEngine and calls init()', () => {
    expect(mockCoachingInit).toHaveBeenCalledTimes(1)
  })

  it('instantiates ScoringEngine (no init — computeAndStore used only on alarm)', () => {
    // ScoringEngine is instantiated but its init is not called
    expect(mockScoringComputeAndStore).not.toHaveBeenCalled()
  })

  it('registers an onInstalled listener', () => {
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1)
  })

  it('registers an onAlarm listener', () => {
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
  })

  it('registers an onMessage listener', () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
  })

  it('does NOT call init() a second time inside onInstalled (no double init)', () => {
    // Baseline: init() was called once at module level
    expect(mockTrackingInit).toHaveBeenCalledTimes(1)
    expect(mockClassifierInit).toHaveBeenCalledTimes(1)
    expect(mockCoachingInit).toHaveBeenCalledTimes(1)

    // Trigger onInstalled — should NOT increment the counts
    triggerInstalled()

    expect(mockTrackingInit).toHaveBeenCalledTimes(1)
    expect(mockClassifierInit).toHaveBeenCalledTimes(1)
    expect(mockCoachingInit).toHaveBeenCalledTimes(1)
  })
})

// ─── onInstalled one-time setup ────────────────────────────────────────────

describe('background/index — onInstalled one-time setup', () => {
  beforeEach(freshImport)

  it('creates a dailySummary alarm with 24-hour period', () => {
    triggerInstalled()
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'dailySummary',
      expect.objectContaining({ periodInMinutes: 24 * 60 })
    )
  })

  it('sets idle detection interval to 300 seconds', () => {
    triggerInstalled()
    expect(chrome.idle.setDetectionInterval).toHaveBeenCalledWith(300)
  })
})

// ─── Alarm routing ────────────────────────────────────────────────────────

describe('background/index — alarm routing', () => {
  beforeEach(freshImport)

  async function fireAlarm(name: string) {
    const handler = getAlarmListener()
    await handler({ name, scheduledTime: Date.now() } as chrome.alarms.Alarm)
  }

  it('classifyBatch → calls classifier.runBatch()', async () => {
    await fireAlarm('classifyBatch')
    expect(mockClassifierRunBatch).toHaveBeenCalledTimes(1)
  })

  it('computeScores → calls scoring.computeAndStore()', async () => {
    await fireAlarm('computeScores')
    expect(mockScoringComputeAndStore).toHaveBeenCalledTimes(1)
  })

  it('dailySummary → calls scoring.computeAndStore()', async () => {
    await fireAlarm('dailySummary')
    expect(mockScoringComputeAndStore).toHaveBeenCalledTimes(1)
  })

  it('dailySummary → calls achievements.evaluate()', async () => {
    await fireAlarm('dailySummary')
    expect(mockAchievementsEvaluate).toHaveBeenCalledTimes(1)
  })

  it('dailySummary with new unlocks → broadcasts ACHIEVEMENT_UNLOCKED', async () => {
    mockAchievementsEvaluate.mockResolvedValueOnce(['deep_learner'])
    await fireAlarm('dailySummary')
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACHIEVEMENT_UNLOCKED', payload: { ids: ['deep_learner'] } })
    )
  })

  it('dailySummary with no unlocks → does NOT broadcast ACHIEVEMENT_UNLOCKED', async () => {
    mockAchievementsEvaluate.mockResolvedValueOnce([])
    await fireAlarm('dailySummary')
    const calls = vi.mocked(chrome.runtime.sendMessage).mock.calls
    const achievementCall = calls.find(c => {
      const msg = c[0] as unknown as { type?: string }
      return msg?.type === 'ACHIEVEMENT_UNLOCKED'
    })
    expect(achievementCall).toBeUndefined()
  })

  it('coachingTick → calls coaching.evaluateRules()', async () => {
    await fireAlarm('coachingTick')
    expect(mockCoachingEvaluateRules).toHaveBeenCalledTimes(1)
  })

  it('coachingTick → also calls scoring.computeAndStore()', async () => {
    await fireAlarm('coachingTick')
    expect(mockScoringComputeAndStore).toHaveBeenCalledTimes(1)
  })

  it('coachingTick with non-null message → delivers notification', async () => {
    mockCoachingEvaluateRules.mockResolvedValueOnce('Time for a break!')
    await fireAlarm('coachingTick')
    expect(mockNotificationDeliver).toHaveBeenCalledWith('Time for a break!')
  })

  it('coachingTick with null result → does NOT deliver notification', async () => {
    mockCoachingEvaluateRules.mockResolvedValueOnce(null)
    await fireAlarm('coachingTick')
    expect(mockNotificationDeliver).not.toHaveBeenCalled()
  })

  it('coachingTick → sends SCORE_UPDATE message to runtime', async () => {
    await fireAlarm('coachingTick')
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCORE_UPDATE' })
    )
  })
})

// ─── Message routing ──────────────────────────────────────────────────────

describe('background/index — message routing', () => {
  beforeEach(freshImport)

  it('GET_SETTINGS → calls getSettings and sends result to sendResponse', async () => {
    const handler = getMessageListener()
    const sendResponse = vi.fn()
    const returnValue = handler({ type: 'GET_SETTINGS' }, {} as chrome.runtime.MessageSender, sendResponse)

    // Must return true to keep the message channel open for async response
    expect(returnValue).toBe(true)

    // Wait for the async getSettings to resolve and call sendResponse
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(mockGetSettings).toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ lastHealthScore: 75 }))
  })

  it('SHORT_WATCHED → calls addShortVideoSession (not in private mode)', async () => {
    mockIsPrivateMode.mockResolvedValueOnce(false)
    const handler = getMessageListener()
    const sendResponse = vi.fn()
    handler(
      { type: 'SHORT_WATCHED', payload: { platform: 'youtube_shorts', count: 3, duration: 120 } },
      {} as chrome.runtime.MessageSender,
      sendResponse
    )
    await vi.waitFor(() => expect(mockAddShortVideoSession).toHaveBeenCalled())
    expect(mockAddShortVideoSession).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'youtube_shorts', count: 3, duration: 120 })
    )
  })

  it('SHORT_WATCHED → skips addShortVideoSession in private mode', async () => {
    mockIsPrivateMode.mockResolvedValueOnce(true)
    const handler = getMessageListener()
    handler(
      { type: 'SHORT_WATCHED', payload: { platform: 'tiktok', count: 1, duration: 60 } },
      {} as chrome.runtime.MessageSender,
      vi.fn()
    )
    // Give async IIFE time to settle
    await new Promise(r => setTimeout(r, 50))
    expect(mockAddShortVideoSession).not.toHaveBeenCalled()
  })

  it('COACHING_RESPONSE → calls addCoachingEvent with correct fields', async () => {
    const handler = getMessageListener()
    handler(
      { type: 'COACHING_RESPONSE', payload: { response: 'take_break', mood: 'tired' } },
      {} as chrome.runtime.MessageSender,
      vi.fn()
    )
    await vi.waitFor(() => expect(mockAddCoachingEvent).toHaveBeenCalled())
    expect(mockAddCoachingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'mindful_checkin',
        userResponse: 'take_break',
        mood: 'tired',
      })
    )
  })

  it('ACTIVITY_SIGNAL → returns false (does not keep channel open)', async () => {
    const handler = getMessageListener()
    const returnValue = handler(
      { type: 'ACTIVITY_SIGNAL', payload: { scrollIntensity: 5, videoPlaying: false, hasFocus: true, timestamp: Date.now() } },
      {} as chrome.runtime.MessageSender,
      vi.fn()
    )
    expect(returnValue).toBeFalsy()
  })

  it('GET_SETTINGS → returns true (keeps channel open for async)', async () => {
    const handler = getMessageListener()
    const returnValue = handler({ type: 'GET_SETTINGS' }, {} as chrome.runtime.MessageSender, vi.fn())
    expect(returnValue).toBe(true)
  })
})

// ─── computeScores broadcasts SCORE_UPDATE ─────────────────────────────────

describe('background/index — computeScores broadcasts SCORE_UPDATE', () => {
  beforeEach(freshImport)

  it('computeScores alarm → sends SCORE_UPDATE with scores payload', async () => {
    const handler = getAlarmListener()
    await handler({ name: 'computeScores', scheduledTime: Date.now() } as chrome.alarms.Alarm)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCORE_UPDATE', payload: expect.objectContaining({ health: 80 }) })
    )
  })
})

// ─── Idle state resets session ─────────────────────────────────────────────

describe('background/index — idle state resets coaching session', () => {
  beforeEach(freshImport)

  function getIdleListener() {
    const calls = vi.mocked(chrome.idle.onStateChanged.addListener).mock.calls
    if (calls.length === 0) throw new Error('No idle listener registered')
    return calls[0][0] as (state: string) => Promise<void>
  }

  it('idle state → calls coaching.resetSession()', async () => {
    const handler = getIdleListener()
    await handler('idle')
    expect(mockCoachingResetSession).toHaveBeenCalledTimes(1)
  })

  it('locked state → calls coaching.resetSession()', async () => {
    const handler = getIdleListener()
    await handler('locked')
    expect(mockCoachingResetSession).toHaveBeenCalledTimes(1)
  })

  it('active state → does NOT call coaching.resetSession()', async () => {
    const handler = getIdleListener()
    await handler('active')
    expect(mockCoachingResetSession).not.toHaveBeenCalled()
  })
})
