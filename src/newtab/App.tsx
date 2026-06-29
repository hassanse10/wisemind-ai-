import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { ScoreCards } from './components/ScoreCards'
import { ScreenTimeDetails } from './components/ScreenTimeDetails'
import { DomainActivity } from './components/DomainActivity'
import { EyeCare } from './components/EyeCare'
import { Timeline } from './components/Timeline'
import { ShortVideoReport } from './components/ShortVideoReport'
import { GoalsProgress } from './components/GoalsProgress'
import { GoalManager } from './components/GoalManager'
import { Achievements } from './components/Achievements'
import { WeeklyReport } from './components/WeeklyReport'
import { WeeklyInsight } from './components/WeeklyInsight'
import { Recommendations } from './components/Recommendations'
import { getLastNDailySummaries, getVisitsByDateRange, getActiveGoals } from '../shared/db'
import { getTodayRange } from '../shared/constants'
import type { Visit, DailySummary, Goal } from '../shared/types'

export function App() {
  const settings = useSettings()
  const [visits, setVisits] = useState<Visit[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<DailySummary[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  const refreshGoals = () => {
    void getActiveGoals().then(setGoals)
  }

  useEffect(() => {
    const { start, end } = getTodayRange()
    void Promise.all([
      getVisitsByDateRange(start, end).then(setVisits),
      getLastNDailySummaries(14).then(setWeeklySummaries),
      getActiveGoals().then(setGoals),
    ])
  }, [])

  const summary = settings?.todaysSummary
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  if (!summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950 font-sans text-sm text-ink-600">
        <div className="text-center">
          <div className="mb-3 font-display text-xl text-ink-200">WiseMind AI</div>
          Tracking starts as you browse. Open a website to begin.
        </div>
      </div>
    )
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950 font-sans text-ink-100">
      <div className="pointer-events-none absolute -right-24 -top-40 h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,.12), transparent 70%)' }} />
      <div className="pointer-events-none absolute -left-28 -top-28 h-[460px] w-[460px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(52,211,153,.10), transparent 70%)' }} />

      <div className="relative mx-auto max-w-5xl space-y-6 px-8 py-9">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] wm-brand-grad shadow-[0_8px_18px_-5px_rgba(52,211,153,.5)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 3c-3 0-5 2-5 4.5 0 1 .4 1.9 1 2.6-.9.7-1.5 1.8-1.5 3C6.5 15.5 8.4 17 11 17h.5v4" stroke="#06231a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 3c3 0 5 2 5 4.5 0 1-.4 1.9-1 2.6.9.7 1.5 1.8 1.5 3C17.5 15.5 15.6 17 13 17" stroke="#06231a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
              </svg>
            </div>
            <div className="font-display text-xl font-semibold tracking-tight">WiseMind AI</div>
          </div>
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-500">{dateLabel}</div>
        </div>

        {/* hero greeting */}
        <div className="max-w-3xl py-2">
          <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-600">{greeting}</div>
          <div className="font-display text-3xl font-medium leading-[1.32] tracking-tight text-ink-100">
            You learned <span className="text-learn">{Math.round((summary.byCategory['learning'] ?? 0) / 60)}m</span> today.{' '}
            The mind grows in the hours you protect for it.
          </div>
        </div>

        <ScoreCards
          health={summary.healthScore}
          productivity={summary.productivityScore}
          learning={summary.learningScore}
        />
        {settings && (
          <Recommendations summary={summary} settings={settings} />
        )}
        <ScreenTimeDetails summary={summary} visits={visits} />
        <Timeline visits={visits} />
        <DomainActivity visits={visits} />
        {summary.shortVideoCount > 0 && <ShortVideoReport summary={summary} />}
        <EyeCare summary={summary} />
        <GoalsProgress goals={goals} summary={summary} />
        <GoalManager goals={goals} onChange={refreshGoals} />
        <WeeklyReport summaries={weeklySummaries} />
        {settings && (
          <WeeklyInsight summaries={weeklySummaries} goals={goals} settings={settings} />
        )}
        <Achievements achievements={settings?.achievements ?? []} />

        {/* Quick actions */}
        <div className="flex justify-center gap-3 pb-4">
          <button
            onClick={() => {
              chrome.windows.getCurrent(w => {
                if (w.id !== undefined) void chrome.sidePanel.open({ windowId: w.id })
              })
            }}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#06231a] transition-opacity hover:opacity-90 wm-brand-grad"
          >
            Open AI Coach
          </button>
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })}
            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
