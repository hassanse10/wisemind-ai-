import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { ScoreCards } from './components/ScoreCards'
import { ScreenTimeDetails } from './components/ScreenTimeDetails'
import { DomainActivity } from './components/DomainActivity'
import { EyeCare } from './components/EyeCare'
import { SleepNote } from './components/SleepNote'
import { Timeline } from './components/Timeline'
import { ShortVideoReport } from './components/ShortVideoReport'
import { GoalsProgress } from './components/GoalsProgress'
import { GoalManager } from './components/GoalManager'
import { Achievements } from './components/Achievements'
import { WeeklyReport } from './components/WeeklyReport'
import { HealthTrends } from './components/HealthTrends'
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
      <div className="flex min-h-screen items-center justify-center bg-[#e9dfc9] font-sans text-sm text-ink-500">
        <div className="text-center">
          <div className="mb-3 font-display text-xl text-ink-100">WiseMind AI</div>
          Tracking starts as you browse. Open a website to begin.
        </div>
      </div>
    )
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-[#e9dfc9] font-sans text-[#362b1a]">
      <div className="mx-auto max-w-5xl space-y-6 px-8 py-9">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2f5238] border-2 border-[#362b1a]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21V9"/>
                <path d="M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z"/>
                <path d="M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z"/>
              </svg>
            </div>
            <div className="font-display text-[22px] tracking-tight text-[#362b1a]">WiseMind AI</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-[20px] bg-[#f6ead2] border-[1.5px] border-[#c9892f] px-4 py-2">
              <span className="text-[13.5px] font-bold text-[#96650f]">✦ Learning streak</span>
            </div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[#7a6a4f]">{dateLabel}</div>
          </div>
        </div>

        {/* hero greeting */}
        <div className="max-w-3xl py-2">
          <div className="mb-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.1em] text-[#8a7a5c]">{greeting}</div>
          <div className="font-display text-[33px] leading-[1.35] tracking-[-0.005em] text-[#362b1a]">
            You learned{' '}
            <span className="text-[#96650f] border-b-[3px] border-[#c9892f]">{Math.round((summary.byCategory['learning'] ?? 0) / 60)}m</span>
            {' '}today.{' '}
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
        {settings && <SleepNote summary={summary} settings={settings} />}
        <GoalsProgress goals={goals} summary={summary} />
        <GoalManager goals={goals} onChange={refreshGoals} />
        <WeeklyReport summaries={weeklySummaries} />
        <HealthTrends summaries={weeklySummaries} />
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
            className="rounded-[20px] border-[1.5px] border-[#2f5238] bg-[#2f5238] px-5 py-2.5 text-sm font-bold text-[#f3ecd9] transition-opacity hover:opacity-90"
          >
            Open AI Coach
          </button>
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })}
            className="rounded-[20px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-transparent px-5 py-2.5 text-sm font-bold text-[#5d5138] transition-colors hover:bg-[rgba(54,43,26,.05)]"
          >
            Breathe
          </button>
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })}
            className="rounded-[20px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-transparent px-5 py-2.5 text-sm font-bold text-[#5d5138] transition-colors hover:bg-[rgba(54,43,26,.05)]"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
