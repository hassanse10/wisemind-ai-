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
