import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSettings, updateSettings, isDomainExcluded, DEFAULT_SETTINGS } from './StorageManager'

beforeEach(() => {
  vi.mocked(chrome.storage.local.get).mockImplementation((_defaults, cb) => {
    cb?.({ ...DEFAULT_SETTINGS })
  })
  vi.mocked(chrome.storage.local.set).mockImplementation((_data, cb) => cb?.())
})

describe('getSettings', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings()
    expect(settings.selectedModel).toBe('openai/gpt-4o-mini')
    expect(settings.coachingEnabled).toBe(true)
  })
})

describe('updateSettings', () => {
  it('calls chrome.storage.local.set with the partial update', async () => {
    await updateSettings({ coachingEnabled: false })
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { coachingEnabled: false },
      expect.any(Function)
    )
  })
})

describe('isDomainExcluded', () => {
  it('returns true when domain is in excludedDomains', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementationOnce((_d, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, excludedDomains: ['facebook.com'] })
    })
    expect(await isDomainExcluded('facebook.com')).toBe(true)
  })

  it('returns false when domain is not excluded', async () => {
    expect(await isDomainExcluded('github.com')).toBe(false)
  })
})

describe('DEFAULT_SETTINGS break timer', () => {
  it('defaults the break interval to 45 minutes', () => {
    expect(DEFAULT_SETTINGS.breakIntervalMinutes).toBe(45)
  })
  it('keeps eyeHealthReminders enabled by default (break-timer flag)', () => {
    expect(DEFAULT_SETTINGS.eyeHealthReminders).toBe(true)
  })
})

describe('DEFAULT_SETTINGS wind-down', () => {
  it('defaults reminders on and tint off', () => {
    expect(DEFAULT_SETTINGS.windDownEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.windDownTintEnabled).toBe(false)
  })
  it('defaults wind-down 21:30 and bedtime 23:00 (minutes since midnight)', () => {
    expect(DEFAULT_SETTINGS.windDownStart).toBe(1290)
    expect(DEFAULT_SETTINGS.windDownBedtime).toBe(1380)
  })
})
