import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { updateSettings } from '../shared/StorageManager'
import type { MentorPersonality, CoachingFrequency } from '../shared/types'

const PERSONALITIES: Array<{ id: MentorPersonality; label: string; desc: string }> = [
  { id: 'wise',     label: 'Wise Mentor',       desc: 'Calm, thoughtful guidance' },
  { id: 'friendly', label: 'Friendly Friend',   desc: 'Relaxed and encouraging' },
  { id: 'coach',    label: 'Tough Coach',        desc: 'Disciplined, motivates action' },
  { id: 'mindful',  label: 'Mindfulness Guide',  desc: 'Peaceful, stress-reducing' },
  { id: 'funny',    label: 'Funny Companion',    desc: 'Playful, light humour' },
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

const toHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
const fromHHMM = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

const sectionClass =
  'bg-[#faf5e9] border-2 border-[#362b1a] rounded-[18px] p-6 space-y-4'
const sectionStyle = { boxShadow: '6px 8px 0 rgba(54,43,26,.18)' }

const inputClass =
  'w-full bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2f5238]'

const segBtn = (active: boolean) =>
  `flex-1 py-2 rounded-lg text-sm transition-colors border-[1.5px] ${
    active
      ? 'bg-[#2f5238] text-[#f3ecd9] border-[#2f5238]'
      : 'bg-[#f3ecd9] text-[#463a25] border-[rgba(54,43,26,.22)]'
  }`

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

  async function saveApiKey() {
    await updateSettings({ openrouterApiKey: apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addDomain() {
    if (!settings) return
    const domain = newDomain.trim().toLowerCase()
    if (!domain || settings.excludedDomains.includes(domain)) return
    updateSettings({ excludedDomains: [...settings.excludedDomains, domain] })
    setNewDomain('')
  }

  function removeDomain(domain: string) {
    if (!settings) return
    updateSettings({ excludedDomains: settings.excludedDomains.filter(d => d !== domain) })
  }

  if (!settings) return <div className="min-h-screen bg-[#e9dfc9]" />

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
    <div className="min-h-screen bg-[#e9dfc9] text-[#362b1a] font-sans p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold font-display text-[#2f5238]">
          WiseMind AI Settings
        </h1>

        {/* API Configuration */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">API Configuration</h2>
          <div>
            <label htmlFor="api-key" className="text-xs text-[#7a6a4f] mb-1 block">
              OpenRouter API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="model-select" className="text-xs text-[#7a6a4f] mb-1 block">
              Model
            </label>
            <select
              id="model-select"
              value={settings.selectedModel}
              onChange={e => updateSettings({ selectedModel: e.target.value })}
              className="w-full bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-4 py-2 text-sm outline-none focus:border-[#2f5238]"
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
            className="bg-[#2f5238] hover:bg-[#4d7c57] text-[#f3ecd9] rounded-[20px] px-6 py-2 text-sm font-medium border-[1.5px] border-[#2f5238] transition-colors"
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </section>

        {/* Mentor Personality */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Mentor Personality</h2>
          <div className="grid grid-cols-1 gap-2">
            {PERSONALITIES.map(p => (
              <button
                key={p.id}
                onClick={() => updateSettings({ mentorPersonality: p.id })}
                className={`text-left px-4 py-3 rounded-xl border-[1.5px] transition-all ${
                  settings.mentorPersonality === p.id
                    ? 'border-[#2f5238] bg-[#eef0e0]'
                    : 'border-[rgba(54,43,26,.22)] bg-[#f3ecd9] hover:border-[rgba(54,43,26,.4)]'
                }`}
              >
                <p className="text-sm font-medium text-[#362b1a]">{p.label}</p>
                <p className="text-xs text-[#7a6a4f]">{p.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Coaching Preferences */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Coaching Preferences</h2>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Enable Coaching</span>
            <input
              type="checkbox"
              checked={settings.coachingEnabled}
              onChange={e => updateSettings({ coachingEnabled: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-2 block">Coaching Frequency</label>
            <div className="flex gap-2">
              {FREQUENCIES.map(f => (
                <button
                  key={f.id}
                  onClick={() => updateSettings({ coachingFrequency: f.id })}
                  className={segBtn(settings.coachingFrequency === f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-1 block">
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
                  className="w-20 bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2f5238]"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Break Reminders */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Break Reminders</h2>
          <p className="text-xs text-[#7a6a4f]">
            Guided eye &amp; movement breaks during continuous screen time. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Enable break reminders</span>
            <input
              type="checkbox"
              checked={settings.eyeHealthReminders}
              onChange={e => updateSettings({ eyeHealthReminders: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-2 block">Remind me every</label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ breakIntervalMinutes: mins })}
                  disabled={!settings.eyeHealthReminders}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 border-[1.5px] ${
                    settings.breakIntervalMinutes === mins
                      ? 'bg-[#2f5238] text-[#f3ecd9] border-[#2f5238]'
                      : 'bg-[#f3ecd9] text-[#463a25] border-[rgba(54,43,26,.22)]'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Bedtime Wind-Down */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Bedtime Wind-Down</h2>
          <p className="text-xs text-[#7a6a4f]">
            Evening reminders and an optional warm screen tint to help you ease toward sleep. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Wind-down reminders</span>
            <input
              type="checkbox"
              checked={settings.windDownEnabled}
              onChange={e => updateSettings({ windDownEnabled: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Warm screen tint at night</span>
            <input
              type="checkbox"
              checked={settings.windDownTintEnabled}
              onChange={e => updateSettings({ windDownTintEnabled: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-[#7a6a4f] mb-1 block">Wind-down starts</label>
              <input
                type="time"
                value={toHHMM(settings.windDownStart)}
                onChange={e => updateSettings({ windDownStart: fromHHMM(e.target.value) })}
                className="w-full bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2f5238]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#7a6a4f] mb-1 block">Target bedtime</label>
              <input
                type="time"
                value={toHHMM(settings.windDownBedtime)}
                onChange={e => updateSettings({ windDownBedtime: fromHHMM(e.target.value) })}
                className="w-full bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2f5238]"
              />
            </div>
          </div>
        </section>

        {/* Posture & Hydration */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Posture &amp; Hydration</h2>
          <p className="text-xs text-[#7a6a4f]">
            Gentle posture and hydration reminders while you work — small toasts that fade on their own, no clicks. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Enable nudges</span>
            <input
              type="checkbox"
              checked={settings.wellnessNudgesEnabled}
              onChange={e => updateSettings({ wellnessNudgesEnabled: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-2 block">Remind me every</label>
            <div className="flex gap-2">
              {[30, 40, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ wellnessNudgeIntervalMinutes: mins })}
                  disabled={!settings.wellnessNudgesEnabled}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 border-[1.5px] ${
                    settings.wellnessNudgeIntervalMinutes === mins
                      ? 'bg-[#2f5238] text-[#f3ecd9] border-[#2f5238]'
                      : 'bg-[#f3ecd9] text-[#463a25] border-[rgba(54,43,26,.22)]'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy & Exclusions */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Privacy &amp; Exclusions</h2>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#463a25]">Private Mode</p>
              <p className="text-xs text-[#7a6a4f]">Pauses all tracking and AI calls</p>
            </div>
            <input
              type="checkbox"
              checked={settings.privateModeActive}
              onChange={() => updateSettings({ privateModeActive: !settings.privateModeActive })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-2 block">Excluded Domains</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDomain()}
                placeholder="example.com"
                className="flex-1 bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-[#362b1a] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2f5238]"
              />
              <button
                onClick={addDomain}
                className="bg-[#2f5238] hover:bg-[#4d7c57] text-[#f3ecd9] rounded-[20px] px-4 py-2 text-sm font-medium border-[1.5px] border-[#2f5238] transition-colors"
              >
                Add
              </button>
            </div>
            {settings.excludedDomains.length > 0 && (
              <ul className="space-y-1">
                {settings.excludedDomains.map(domain => (
                  <li
                    key={domain}
                    className="flex items-center justify-between bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.22)] rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-[#463a25]">{domain}</span>
                    <button
                      onClick={() => removeDomain(domain)}
                      className="text-xs text-[#8a4326] hover:text-[#b85c38]"
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
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25] mb-3">Theme</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#463a25]">Appearance</span>
            <span className="px-3 py-1 rounded-full text-sm bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.25)] text-[#5d5138]">
              Fable
            </span>
          </div>
        </section>

        {/* Data Management */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-extrabold font-display text-[#463a25]">Data</h2>
          <div className="flex gap-3">
            <button
              onClick={exportData}
              className="flex-1 bg-transparent hover:bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.35)] text-[#5d5138] rounded-[20px] py-2 text-sm transition-colors"
            >
              Export Data
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex-1 bg-[#f4e7e0] hover:bg-[#f0d9cf] border-[1.5px] border-[#b85c38] text-[#8a4326] rounded-[20px] py-2 text-sm transition-colors"
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
          <div
            className="bg-[#faf5e9] rounded-[18px] p-6 max-w-sm w-full mx-4 border-2 border-[#362b1a] space-y-4"
            style={{ boxShadow: '6px 8px 0 rgba(54,43,26,.18)' }}
          >
            <h3 id="confirm-title" className="text-base font-semibold font-display text-[#362b1a]">
              Clear All Data?
            </h3>
            <p className="text-sm text-[#5d5138]">
              This will permanently delete all browsing history, scores, and summaries. This cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-transparent hover:bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.35)] text-[#5d5138] rounded-[20px] py-2 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={clearData}
                className="flex-1 bg-[#f4e7e0] hover:bg-[#f0d9cf] border-[1.5px] border-[#b85c38] text-[#8a4326] rounded-[20px] py-2 text-sm transition-colors"
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
