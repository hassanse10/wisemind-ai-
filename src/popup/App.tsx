import { useState, useEffect } from 'react'
import { ScoreRing } from './components/ScoreRing'
import { ScreenTimeBar } from './components/ScreenTimeBar'
import { CoachingCard } from './components/CoachingCard'
import { useSettings } from '../shared/hooks/useStorage'
import { useScores } from '../shared/hooks/useScores'
import { getShortVideosByDateRange, getVisitsByDateRange } from '../shared/db'
import { getTodayRange } from '../shared/constants'

const BRAND_MARK = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21V9"/>
    <path d="M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z"/>
    <path d="M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z"/>
  </svg>
)

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[13px] border-[1.5px] border-[rgba(54,43,26,.25)] bg-[#f3ecd9] px-[13px] py-[10px]">
      <div className="mb-[7px] flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-ink-300">{label}</span>
        <span className="font-display text-base" style={{ color }}>{value}</span>
      </div>
      <div className="h-[6px] overflow-hidden rounded-[3px] bg-[rgba(54,43,26,.1)]">
        <div className="h-full rounded-[3px]" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

export function App() {
  const settings = useSettings()
  const scores = useScores()
  const [coachMsg, setCoachMsg] = useState<string | null>(null)

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
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })

  return (
    <div className="relative w-[400px] min-h-[580px] overflow-hidden bg-[#faf5e9] p-0 font-sans text-ink-100">

      <div className="relative flex flex-col gap-4 p-[22px]">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full border-2 border-[#362b1a] bg-[#2f5238]">
              {BRAND_MARK}
            </div>
            <div>
              <div className="font-display text-[17px] tracking-[-0.01em] text-ink-100">WiseMind</div>
              <div className="text-[12.5px] font-medium text-ink-500">{today}</div>
            </div>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-[rgba(54,43,26,.3)] bg-transparent text-ink-400 transition-colors hover:text-ink-200"
            aria-label="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M19.4 13.5a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.1a2 2 0 11-4 0v-.2a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.2a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H13a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V13a1.7 1.7 0 001.5 1z" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
        </div>

        {/* score hero */}
        <div className="flex items-center gap-[18px]">
          <ScoreRing score={health} label="Health" color="#4d7c57" size={128} />
          <div className="flex flex-1 flex-col gap-2.5">
            <Pill label="Productivity" value={productivity} color="#58789f" />
            <Pill label="Learning" value={learning} color="#c9892f" />
          </div>
        </div>

        {/* screen time */}
        {summary && summary.totalTime > 0 && <ScreenTimeBar summary={summary} />}

        {/* short video counter */}
        {shortCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[#b85c38] bg-[#f4e7e0] px-3.5 py-3">
            <span className="text-lg">📱</span>
            <span className="text-sm text-ink-200">
              <b className="font-display text-[#b85c38]">{shortCount}</b> Shorts today
            </span>
          </div>
        )}

        {/* coaching card */}
        {coachMsg && <CoachingCard message={coachMsg} onDismiss={() => setCoachMsg(null)} />}

        {/* quick links */}
        <div className="mt-1 flex gap-2">
          <QuickLink label="Dashboard" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
          <QuickLink label="Breathe" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })} />
          <QuickLink
            label="AI Coach"
            onClick={() => chrome.windows.getCurrent(w => { if (w.id !== undefined) void chrome.sidePanel.open({ windowId: w.id }) })}
          />
          <QuickLink label="Goals" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
        </div>

        {/* diagnostic status */}
        <p className="text-center text-[10px] text-ink-700">
          tracked today · shorts: {liveShorts === null ? '…' : liveShorts} · visits: {liveVisits === null ? '…' : liveVisits}
        </p>
      </div>
    </div>
  )
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1.5 rounded-[13px] border-[1.5px] border-[rgba(54,43,26,.22)] bg-[#f3ecd9] px-1 py-3 text-[12px] font-bold text-ink-300 transition-colors hover:bg-[#ede5cf]"
    >
      {label}
    </button>
  )
}
