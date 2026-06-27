import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { ScoreCards } from './components/ScoreCards'
import { Timeline } from './components/Timeline'
import { ShortVideoReport } from './components/ShortVideoReport'
import { GoalsProgress } from './components/GoalsProgress'
import { GoalManager } from './components/GoalManager'
import { Achievements } from './components/Achievements'
import { WeeklyReport } from './components/WeeklyReport'
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
  if (!summary) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500 text-sm">
        Tracking starts as you browse. Open a website to begin.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            WiseMind AI
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <ScoreCards
          health={summary.healthScore}
          productivity={summary.productivityScore}
          learning={summary.learningScore}
        />
        {settings && (
          <Recommendations summary={summary} settings={settings} />
        )}
        <Timeline visits={visits} />
        {summary.shortVideoCount > 0 && <ShortVideoReport summary={summary} />}
        <GoalsProgress goals={goals} summary={summary} />
        <GoalManager goals={goals} onChange={refreshGoals} />
        <WeeklyReport summaries={weeklySummaries} />
        <Achievements achievements={settings?.achievements ?? []} />

        {/* Quick actions */}
        <div className="flex gap-3 justify-center pb-4">
          <button
            onClick={() => {
              chrome.windows.getCurrent(w => {
                if (w.id !== undefined) void chrome.sidePanel.open({ windowId: w.id })
              })
            }}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
          >
            Open AI Coach
          </button>
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  )
}
