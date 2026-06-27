import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { updateSettings } from '../shared/StorageManager'
import type { MentorPersonality, Theme, CoachingFrequency } from '../shared/types'

const PERSONALITIES: Array<{ id: MentorPersonality; label: string; desc: string }> = [
  { id: 'wise', label: 'Wise Mentor', desc: 'Calm, thoughtful, reflective.' },
  { id: 'friendly', label: 'Friendly Friend', desc: 'Relaxed, positive, casual.' },
  { id: 'strict', label: 'Strict Coach', desc: 'Disciplined, direct, no excuses.' },
  { id: 'motivational', label: 'Motivational Guide', desc: 'Energetic, inspiring, goal-focused.' },
]

const MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-haiku-4-5',
  'anthropic/claude-sonnet-4-5',
  'google/gemini-flash-1.5',
]

const FREQUENCIES: Array<{ id: CoachingFrequency; label: string }> = [
  { id: 'gentle', label: 'Minimal' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'assertive', label: 'Active' },
]

export function App() {
  const settings = useSettings()
  const [apiKey, setApiKey] = useState(settings?.openrouterApiKey ?? '')
  const [saved, setSaved] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    if (settings?.openrouterApiKey !== undefined) {
      setApiKey(settings.openrouterApiKey)
    }
  }, [settings?.openrouterApiKey])

  if (!settings) return <div className="min-h-screen bg-slate-900" />

  async function saveApiKey() {
    await updateSettings({ openrouterApiKey: apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addDomain() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain || settings.excludedDomains.includes(domain)) return
    updateSettings({ excludedDomains: [...settings.excludedDomains, domain] })
    setNewDomain('')
  }

  function removeDomain(domain: string) {
    updateSettings({ excludedDomains: settings.excludedDomains.filter(d => d !== domain) })
  }

  async function clearData() {
    const { getDB } = await import('../shared/db')
    const db = await getDB()
    await db.clear('visits')
    await db.clear('shortVideos')
    await db.clear('coachingEvents')
    await db.clear('dailySummaries')
    await updateSettings({ todaysSummary: null, lastHealthScore: 0, achievements: [], ruleLastFired: {} })
    setShowClearConfirm(false)
  }

  async function exportData() {
    const { getDB } = await import('../shared/db')
    const db = await getDB()
    const data = {
      visits: await db.getAll('visits'),
      shortVideos: await db.getAll('shortVideos'),
      dailySummaries: await db.getAll('dailySummaries'),
      goals: await db.getAll('goals'),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wisemind-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
          WiseMind AI Settings
        </h1>

        {/* API Configuration */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">API Configuration</h2>
          <div>
            <label htmlFor="api-key" className="text-xs text-slate-500 mb-1 block">
              OpenRouter API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="model-select" className="text-xs text-slate-500 mb-1 block">
              Model
            </label>
            <select
              id="model-select"
              value={settings.selectedModel}
              onChange={e => updateSettings({ selectedModel: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100"
            >
              {MODELS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={saveApiKey}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-2 text-sm font-medium"
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </section>

        {/* Mentor Personality */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Mentor Personality</h2>
          <div className="grid grid-cols-1 gap-2">
            {PERSONALITIES.map(p => (
              <button
                key={p.id}
                onClick={() => updateSettings({ mentorPersonality: p.id })}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  settings.mentorPersonality === p.id
                    ? 'border-blue-500 bg-blue-950/60'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <p className="text-sm font-medium text-slate-200">{p.label}</p>
                <p className="text-xs text-slate-500">{p.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Coaching Preferences */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Coaching Preferences</h2>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable Coaching</span>
            <input
              type="checkbox"
              checked={settings.coachingEnabled}
              onChange={e => updateSettings({ coachingEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Coaching Frequency</label>
            <div className="flex gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f.id}
                  onClick={() => updateSettings({ coachingFrequency: f.id })}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    settings.coachingFrequency === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Coaching Hours ({settings.coachingHours.start}:00 – {settings.coachingHours.end}:00)
            </label>
            <div className="flex gap-3">
              {(['start', 'end'] as const).map(k => (
                <input
                  key={k}
                  type="number"
                  min={0}
                  max={23}
                  value={settings.coachingHours[k]}
                  onChange={e =>
                    updateSettings({
                      coachingHours: { ...settings.coachingHours, [k]: Number(e.target.value) },
                    })
                  }
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Eye Health Reminders</span>
            <input
              type="checkbox"
              checked={settings.eyeHealthReminders}
              onChange={e => updateSettings({ eyeHealthReminders: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
        </section>

        {/* Privacy & Exclusions */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Privacy &amp; Exclusions</h2>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Private Mode</p>
              <p className="text-xs text-slate-500">Pauses all tracking and AI calls</p>
            </div>
            <input
              type="checkbox"
              checked={settings.privateModeActive}
              onChange={() => updateSettings({ privateModeActive: !settings.privateModeActive })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Excluded Domains</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="example.com"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              />
              <button
                onClick={addDomain}
                className="bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-2 text-sm text-slate-300"
              >
                Add
              </button>
            </div>
            {settings.excludedDomains.length > 0 && (
              <ul className="space-y-1">
                {settings.excludedDomains.map(domain => (
                  <li
                    key={domain}
                    className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-slate-300">{domain}</span>
                    <button
                      onClick={() => removeDomain(domain)}
                      className="text-xs text-red-400 hover:text-red-300"
                      aria-label={`Remove ${domain}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Theme */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Theme</h2>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as Theme[]).map(t => (
              <button
                key={t}
                onClick={() => updateSettings({ theme: t })}
                className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                  settings.theme === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Data</h2>
          <div className="flex gap-3">
            <button
              onClick={exportData}
              className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm text-slate-300"
            >
              Export Data
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex-1 bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 rounded-lg py-2 text-sm text-red-400"
            >
              Clear Data
            </button>
          </div>
        </section>
      </div>

      {/* Clear data confirmation dialog */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        >
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-slate-700 space-y-4">
            <h3 id="confirm-title" className="text-base font-semibold text-slate-100">
              Clear All Data?
            </h3>
            <p className="text-sm text-slate-400">
              This will permanently delete all browsing history, scores, and summaries. This cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={clearData}
                className="flex-1 bg-red-600 hover:bg-red-500 rounded-lg py-2 text-sm text-white"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
