import { useState, useEffect } from 'react'
import { ScoreRing } from './components/ScoreRing'
import { ScreenTimeBar } from './components/ScreenTimeBar'
import { CoachingCard } from './components/CoachingCard'
import { useSettings } from '../shared/hooks/useStorage'
import { useScores } from '../shared/hooks/useScores'
import { getShortVideosByDateRange, getVisitsByDateRange } from '../shared/db'
import { getTodayRange } from '../shared/constants'

export function App() {
  const settings = useSettings()
  const scores = useScores()
  const [coachMsg, setCoachMsg] = useState<string | null>(null)

  // Read today's activity straight from the shared extension database so the
  // counts appear the moment they are recorded — no waiting for the 5-minute
  // summary recompute. (Popup and the service worker share one IndexedDB.)
  const [liveShorts, setLiveShorts] = useState<number | null>(null)
  const [liveVisits, setLiveVisits] = useState<number | null>(null)
  useEffect(() => {
    const { start, end } = getTodayRange()
    void getShortVideosByDateRange(start, end)
      .then(s => setLiveShorts(s.reduce((sum, sv) => sum + sv.count, 0)))
      .catch(() => setLiveShorts(-1))
    void getVisitsByDateRange(start, end)
      .then(v => setLiveVisits(v.length))
      .catch(() => setLiveVisits(-1))
  }, [])

  const summary = settings?.todaysSummary
  const health = scores?.health ?? settings?.lastHealthScore ?? 0
  const productivity = scores?.productivity ?? 0
  const learning = scores?.learning ?? 0
  const shortCount = liveShorts ?? summary?.shortVideoCount ?? 0

  return (
    <div className="w-[400px] min-h-[580px] bg-slate-900 text-slate-100 p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-blue-400">WiseMind AI</h1>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
        <button onClick={() => chrome.runtime.openOptionsPage()} className="text-slate-500 hover:text-slate-300 text-lg">⚙</button>
      </div>

      {/* Score rings */}
      <div className="flex justify-around">
        <ScoreRing score={health} label="Health" color="#10b981" size={80} />
        <ScoreRing score={productivity} label="Productivity" color="#3b82f6" size={80} />
        <ScoreRing score={learning} label="Learning" color="#8b5cf6" size={80} />
      </div>

      {/* Screen time bar */}
      {summary && <ScreenTimeBar summary={summary} />}

      {/* Short video counter (live from the database) */}
      {shortCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/20 rounded-lg px-3 py-2">
          <span className="text-amber-400 text-lg">📱</span>
          <span className="text-sm text-slate-300">{shortCount} Shorts today</span>
        </div>
      )}

      {/* Coaching card */}
      {coachMsg && <CoachingCard message={coachMsg} onDismiss={() => setCoachMsg(null)} />}

      {/* Quick links */}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })}
          className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-slate-300">
          Dashboard
        </button>
        <button onClick={() => {
          chrome.windows.getCurrent(w => {
            if (w.id !== undefined) chrome.sidePanel.open({ windowId: w.id })
          })
        }}
          className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-slate-300">
          AI Coach
        </button>
      </div>

      {/* Diagnostic status — shows whether the tracker is recording data today */}
      <p className="text-[10px] text-slate-600 text-center">
        tracked today · shorts: {liveShorts === null ? '…' : liveShorts} · visits: {liveVisits === null ? '…' : liveVisits}
      </p>
    </div>
  )
}
