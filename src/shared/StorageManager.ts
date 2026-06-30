import type { ExtensionSettings } from './types'

export const DEFAULT_SETTINGS: ExtensionSettings = {
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
  breakIntervalMinutes: 45,
  windDownEnabled: true,
  windDownTintEnabled: false,
  windDownStart: 1290,
  windDownBedtime: 1380,
  wellnessNudgesEnabled: true,
  wellnessNudgeIntervalMinutes: 40,
  lastHealthScore: 0,
  todaysSummary: null,
  achievements: [],
  ruleLastFired: {},
}

export function getSettings(): Promise<ExtensionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULT_SETTINGS as unknown as string[], result => {
      resolve(result as unknown as ExtensionSettings)
    })
  })
}

export function updateSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set(partial, resolve)
  })
}

export async function getApiKey(): Promise<string> {
  return (await getSettings()).openrouterApiKey
}

export async function isPrivateMode(): Promise<boolean> {
  return (await getSettings()).privateModeActive
}

export async function isDomainExcluded(domain: string): Promise<boolean> {
  const { excludedDomains } = await getSettings()
  return excludedDomains.includes(domain)
}

export async function markRuleFired(ruleId: string): Promise<void> {
  const { ruleLastFired } = await getSettings()
  await updateSettings({ ruleLastFired: { ...ruleLastFired, [ruleId]: Date.now() } })
}

export async function getRuleLastFired(ruleId: string): Promise<number> {
  const { ruleLastFired } = await getSettings()
  return ruleLastFired[ruleId] ?? 0
}
