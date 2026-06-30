import { useState, useEffect } from 'react'
import { ScoreRing } from './components/ScoreRing'
import { ScreenTimeBar } from './components/ScreenTimeBar'
import { CoachingCard } from './components/CoachingCard'
import { useSettings } from '../shared/hooks/useStorage'
import { useScores } from '../shared/hooks/useScores'
import { getShortVideosByDateRange, getVisitsByDateRange } from '../shared/db'
import { getTodayRange } from '../shared/constants'

const BRAND_MARK = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <path d="M12 3c-3 0-5 2-5 4.5 0 1 .4 1.9 1 2.6-.9.7-1.5 1.8-1.5 3C6.5 15.5 8.4 17 11 17h.5v4" stroke="#06231a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 3c3 0 5 2 5 4.5 0 1-.4 1.9-1 2.6.9.7 1.5 1.8 1.5 3C17.5 15.5 15.6 17 13 17" stroke="#06231a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
  </svg>
)

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink-400">{label}</span>
        <span className="font-display text-base font-semibold" style={{ color }}>{value}</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
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
    <div className="relative w-[400px] min-h-[580px] overflow-hidden bg-navy-900 p-0 font-sans text-ink-100">
      <div
        className="absolute -left-16 -top-32 h-[300px] w-[300px]"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,.16), transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-4 p-[22px]">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] wm-brand-grad shadow-[0_6px_16px_-4px_rgba(52,211,153,.5)]">
              {BRAND_MARK}
            </div>
            <div>
              <div className="font-display text-base font-semibold tracking-tight">WiseMind</div>
              <div className="mt-px text-[11.5px] font-medium text-ink-600">{today}</div>
            </div>
          </div>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/5 text-ink-500 transition-colors hover:text-ink-300"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>

        {/* score hero */}
        <div className="flex items-center gap-[18px]">
          <ScoreRing score={health} label="Health" color="#34d399" size={128} />
          <div className="flex flex-1 flex-col gap-2.5">
            <Pill label="Productivity" value={productivity} color="#5b9bff" />
            <Pill label="Learning" value={learning} color="#f7b955" />
          </div>
        </div>

        {/* screen time */}
        {summary && summary.totalTime > 0 && <ScreenTimeBar summary={summary} />}

        {/* short video counter */}
        {shortCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-shorts/20 bg-shorts/[0.08] px-3.5 py-3">
            <span className="text-lg">📱</span>
            <span className="text-sm text-ink-200">
              <b className="font-display text-shorts">{shortCount}</b> Shorts today
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
      className="flex flex-1 flex-col items-center gap-1.5 rounded-[13px] border border-white/[0.05] bg-white/[0.04] px-1 py-3 text-[11px] font-semibold text-ink-400 transition-colors hover:bg-white/[0.07]"
    >
      {label}
    </button>
  )
}
