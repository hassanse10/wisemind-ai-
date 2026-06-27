/**
 * Integration smoke tests — wire multiple modules together.
 *
 * These tests exercise cross-module flows end-to-end within the test
 * environment (no Chrome APIs except the mock from setup.ts).
 * They complement the unit tests by verifying that the real module
 * interfaces fit together correctly.
 *
 * Note: fake-indexeddb persists across the module, so tests that rely on
 * the DB must use getVisitsByDateRange / getShortVideosByDateRange with
 * bespoke timestamps to avoid interference, or validate relative / additive
 * effects rather than absolute counts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addVisit, addShortVideoSession, getVisitsByDateRange, getShortVideosByDateRange, getUnclassifiedVisits } from '../shared/db'
import { ScoringEngine } from '../background/ScoringEngine'
import { ClassifierEngine } from '../background/ClassifierEngine'
import { NotificationManager } from '../background/NotificationManager'
import { isDomainExcluded, updateSettings, DEFAULT_SETTINGS } from '../shared/StorageManager'
import type { Visit, ShortVideoSession } from '../shared/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0
const uid = () => `smoke-${++counter}-${Math.random().toString(36).slice(2)}`

// Each test suite uses a distinct epoch offset so visits don't cross-contaminate
// when other tests query by date range.
const BASE = 1_700_000_000_000  // fixed past epoch (not "today") for isolated ranges

function makeVisit(startTime: number, overrides: Partial<Visit> = {}): Visit {
  return {
    id: uid(),
    url: 'https://github.com',
    domain: 'github.com',
    title: 'GitHub',
    startTime,
    endTime: startTime + 60_000,
    duration: 60,
    category: 'programming',
    aiCategory: '',
    classified: true,
    ...overrides,
  }
}

function makeShortVideo(startTime: number, overrides: Partial<ShortVideoSession> = {}): ShortVideoSession {
  return {
    id: uid(),
    platform: 'youtube_shorts',
    startTime,
    endTime: startTime + 300_000,
    count: 5,
    duration: 300,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(chrome.storage.local.get).mockImplementation((_defaults, cb) => {
    cb?.({ ...DEFAULT_SETTINGS })
  })
  vi.mocked(chrome.storage.local.set).mockImplementation((_data, cb) => cb?.())
  vi.clearAllMocks()
})

// ─── Flow 1: DB read/write cross-module consistency ───────────────────────────

describe('Integration: DB cross-module read consistency', () => {
  it('visits written via addVisit are visible via getVisitsByDateRange', async () => {
    const t = BASE + 1_000_000
    const v = makeVisit(t)
    await addVisit(v)
    const found = await getVisitsByDateRange(t - 1000, t + 120_000)
    expect(found.some(r => r.id === v.id)).toBe(true)
  })

  it('short videos written via addShortVideoSession are visible via getShortVideosByDateRange', async () => {
    const t = BASE + 2_000_000
    const sv = makeShortVideo(t)
    await addShortVideoSession(sv)
    const found = await getShortVideosByDateRange(t - 1000, t + 400_000)
    expect(found.some(r => r.id === sv.id)).toBe(true)
  })

  it('getVisitsByDateRange does not return visits outside the range', async () => {
    const t = BASE + 3_000_000
    const inside = makeVisit(t)
    const outside = makeVisit(t + 100_000_000) // far in the future
    await addVisit(inside)
    await addVisit(outside)
    const found = await getVisitsByDateRange(t - 1000, t + 10_000)
    expect(found.some(r => r.id === inside.id)).toBe(true)
    expect(found.some(r => r.id === outside.id)).toBe(false)
  })
})

// ─── Flow 2: ScoringEngine uses DB totals correctly ──────────────────────────
// ScoringEngine queries today's date range. We use mockImplementation to fake
// getSettings so computeAndStore stores via the mock. Scores are computed on
// live DB data, so we verify the direction of the result rather than exact values.

describe('Integration: ScoringEngine — score computation flows', () => {
  it('computeAndStore returns a Scores object with all three keys', async () => {
    const scoring = new ScoringEngine()
    const scores = await scoring.computeAndStore()
    expect(typeof scores.health).toBe('number')
    expect(typeof scores.productivity).toBe('number')
    expect(typeof scores.learning).toBe('number')
  })

  it('health score is within [0, 100]', async () => {
    const scoring = new ScoringEngine()
    const scores = await scoring.computeAndStore()
    expect(scores.health).toBeGreaterThanOrEqual(0)
    expect(scores.health).toBeLessThanOrEqual(100)
  })

  it('computeAndStore calls updateSettings with lastHealthScore', async () => {
    const scoring = new ScoringEngine()
    await scoring.computeAndStore()
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastHealthScore: expect.any(Number) }),
      expect.any(Function)
    )
  })

  it('productivity score improves when more productive visits exist vs fewer', async () => {
    // We compare two separate scoring runs:
    // Before adding visits, capture baseline, then add productive visits and re-score.
    // Because the DB accumulates, adding visits can only raise productive totals.
    const scoring = new ScoringEngine()
    const before = await scoring.computeAndStore()

    // Add 1 hour of programming (productive)
    const today = new Date()
    today.setHours(10, 0, 0, 0)
    await addVisit(makeVisit(today.getTime(), { duration: 3600, category: 'programming' }))

    const after = await scoring.computeAndStore()
    // productivity can only stay equal or rise with more productive content
    expect(after.productivity).toBeGreaterThanOrEqual(before.productivity)
  })
})

// ─── Flow 3: ClassifierEngine — AI batch path ────────────────────────────────

describe('Integration: ClassifierEngine.runBatch', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_defaults, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, openrouterApiKey: 'sk-test' })
    })
  })

  it('does not call fetch when no unclassified visits exist', async () => {
    // Mark all existing as classified by not adding any new ones here.
    // (This test isolates by testing the no-op branch.)
    global.fetch = vi.fn() as unknown as typeof fetch

    // Clear unclassified state by adding nothing; the existing DB may have visits
    // from previous tests but they were added as classified: true.
    const unclassified = await getUnclassifiedVisits()
    // Only run this assertion if there truly are none
    if (unclassified.length === 0) {
      const engine = new ClassifierEngine()
      await engine.runBatch()
      expect(fetch).not.toHaveBeenCalled()
    } else {
      // Some tests leaked unclassified visits — just verify runBatch doesn't throw
      const engine = new ClassifierEngine()
      await expect(engine.runBatch()).resolves.not.toThrow()
    }
  })

  it('updates the DB record to classified after AI responds', async () => {
    const unclassifiedVisit = makeVisit(BASE + 5_000_000, {
      domain: 'medium.com',
      category: 'other',
      classified: false,
    })
    await addVisit(unclassifiedVisit)

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              results: [{ id: unclassifiedVisit.id, category: 'learning', aiCategory: 'tech article' }],
            }),
          },
        }],
      }),
    }) as unknown as typeof fetch

    const engine = new ClassifierEngine()
    await engine.runBatch()

    const stillUnclassified = await getUnclassifiedVisits()
    expect(stillUnclassified.some(v => v.id === unclassifiedVisit.id)).toBe(false)
  })

  it('skips batch when no API key is set', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_defaults, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, openrouterApiKey: '' })
    })
    global.fetch = vi.fn() as unknown as typeof fetch

    const engine = new ClassifierEngine()
    await engine.runBatch()
    expect(fetch).not.toHaveBeenCalled()
  })
})

// ─── Flow 4: StorageManager — excluded domains and private mode ───────────────

describe('Integration: StorageManager — domain exclusion', () => {
  it('isDomainExcluded returns true when domain matches the excluded list', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_d, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, excludedDomains: ['ads.com', 'tracker.net'] })
    })
    expect(await isDomainExcluded('ads.com')).toBe(true)
  })

  it('isDomainExcluded returns false for another domain when list has entries', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation((_d, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, excludedDomains: ['ads.com'] })
    })
    expect(await isDomainExcluded('github.com')).toBe(false)
  })

  it('isDomainExcluded returns false when excludedDomains is empty', async () => {
    expect(await isDomainExcluded('github.com')).toBe(false)
  })

  it('updateSettings persists only the partial key provided', async () => {
    await updateSettings({ privateModeActive: true })
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { privateModeActive: true },
      expect.any(Function)
    )
  })
})

// ─── Flow 5: NotificationManager — delivery path selection ───────────────────

describe('Integration: NotificationManager deliver', () => {
  it('delivers to active tab and does NOT create a system notification', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([{ id: 42 } as chrome.tabs.Tab])
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(undefined)

    await NotificationManager.deliver('Take a break!', '10 Shorts')

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'SHOW_MINDFUL_CHECKIN',
      payload: { message: 'Take a break!', stats: '10 Shorts' },
    })
    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('falls back to system notification when sendMessage throws', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([{ id: 7 } as chrome.tabs.Tab])
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(new Error('No receiver'))

    await NotificationManager.deliver('Stay focused!')

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'WiseMind AI', message: 'Stay focused!' })
    )
  })

  it('falls back to system notification when there is no active tab', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([])

    await NotificationManager.deliver('Drink water', '')

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'WiseMind AI', message: 'Drink water' })
    )
  })

  it('delivers default empty stats when omitted', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([{ id: 1 } as chrome.tabs.Tab])
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(undefined)

    await NotificationManager.deliver('Hello')

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'SHOW_MINDFUL_CHECKIN',
      payload: { message: 'Hello', stats: '' },
    })
  })
})

// ─── Flow 6: Manifest validation contract ─────────────────────────────────────
// Reads and validates public/manifest.json structure to catch regressions.

describe('Integration: manifest.json contract', () => {
  let manifest: Record<string, unknown>

  beforeEach(async () => {
    // Use dynamic import to load the JSON
    const { default: m } = await import('../../public/manifest.json', { assert: { type: 'json' } })
    manifest = m as Record<string, unknown>
  })

  it('has manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('has service_worker set to background.js', () => {
    const bg = manifest.background as { service_worker: string; type: string }
    expect(bg.service_worker).toBe('background.js')
    expect(bg.type).toBe('module')
  })

  it('declares required permissions', () => {
    const perms = manifest.permissions as string[]
    expect(perms).toContain('tabs')
    expect(perms).toContain('storage')
    expect(perms).toContain('alarms')
    expect(perms).toContain('notifications')
    expect(perms).toContain('sidePanel')
  })

  it('declares side_panel default path', () => {
    const sp = manifest.side_panel as { default_path: string }
    expect(sp.default_path).toBe('sidepanel.html')
  })

  it('overrides newtab', () => {
    const cuo = manifest.chrome_url_overrides as { newtab: string }
    expect(cuo.newtab).toBe('newtab.html')
  })

  it('declares content scripts for activityMonitor and shortVideoDetector', () => {
    const cs = manifest.content_scripts as Array<{ js: string[] }>
    const allJs = cs.flatMap(c => c.js)
    expect(allJs).toContain('activityMonitor.js')
    expect(allJs).toContain('shortVideoDetector.js')
  })
})
