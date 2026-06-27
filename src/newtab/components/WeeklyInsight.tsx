import { useState, useEffect } from 'react'
import type { DailySummary, ExtensionSettings, Goal } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  summaries: DailySummary[]
  goals: Goal[]
  settings: ExtensionSettings
}

type State =
  | { status: 'no_key' }
  | { status: 'private_mode' }
  | { status: 'loading' }
  | { status: 'loaded'; text: string }
  | { status: 'error' }

// ---------------------------------------------------------------------------
// Personality tones (mirrors CoachingEngine and Recommendations)
// ---------------------------------------------------------------------------
const PERSONALITY_TONES: Record<string, string> = {
  wise: 'Calm, thoughtful, like an experienced mentor. Ask reflective questions.',
  friendly: 'Relaxed, positive, encouraging, casual language.',
  coach: 'Disciplined, direct, challenges excuses, motivates action.',
  mindful: 'Peaceful, focuses on breathing and stress reduction.',
  funny: 'Playful, uses light humour, never mean-spirited.',
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------
interface WeekAggregate {
  days: number
  avgHealth: number
  avgProductivity: number
  avgLearning: number
  totalShortVideos: number
  totalLateNightMinutes: number
  goalDescriptions: string[]
}

function aggregateWeek(summaries: DailySummary[], goals: Goal[]): WeekAggregate {
  const days = summaries.length
  const avgHealth = days > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.healthScore, 0) / days)
    : 0
  const avgProductivity = days > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.productivityScore, 0) / days)
    : 0
  const avgLearning = days > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.learningScore, 0) / days)
    : 0
  const totalShortVideos = summaries.reduce((sum, s) => sum + s.shortVideoCount, 0)
  const totalLateNightMinutes = summaries.reduce((sum, s) => sum + s.lateNightMinutes, 0)
  const goalDescriptions = goals.map(g => {
    const limit = g.dailyLimitMinutes !== null ? ` limit:${g.dailyLimitMinutes}min/day` : ''
    return `${g.type} ${g.target}${limit}`
  })

  return { days, avgHealth, avgProductivity, avgLearning, totalShortVideos, totalLateNightMinutes, goalDescriptions }
}

// ---------------------------------------------------------------------------
// OpenRouter fetch
// ---------------------------------------------------------------------------
async function fetchWeeklyInsight(
  summaries: DailySummary[],
  goals: Goal[],
  settings: ExtensionSettings,
  signal: AbortSignal
): Promise<string> {
  const tone =
    PERSONALITY_TONES[settings.mentorPersonality] ?? PERSONALITY_TONES.wise

  const system =
    `You are a digital wellness coach inside a Chrome extension. ` +
    `Tone: ${tone}. ` +
    `Produce EXACTLY a 3-sentence reflection on the user's past week. ` +
    `Encouraging, specific, never shaming. Plain text only.`

  const agg = aggregateWeek(summaries, goals)
  const userContent = JSON.stringify({
    days: agg.days,
    avgHealthScore: agg.avgHealth,
    avgProductivityScore: agg.avgProductivity,
    avgLearningScore: agg.avgLearning,
    totalShortVideos: agg.totalShortVideos,
    totalLateNightMinutes: agg.totalLateNightMinutes,
    activeGoals: agg.goalDescriptions,
  })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${settings.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://wisemind-ai',
      'X-Title': 'WiseMind AI',
    },
    body: JSON.stringify({
      model: settings.selectedModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter responded with ${res.status}`)

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const text = (data.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error('Empty response from OpenRouter')
  return text
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading weekly insight">
      {[0, 1].map(i => (
        <div
          key={i}
          className="h-5 bg-slate-700/40 rounded-xl animate-pulse"
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner card — always rendered after early-return guard in parent
// ---------------------------------------------------------------------------
function WeeklyInsightCard({ summaries, goals, settings }: Props) {
  const [state, setState] = useState<State>(
    settings.privateModeActive
      ? { status: 'private_mode' }
      : settings.openrouterApiKey
        ? { status: 'loading' }
        : { status: 'no_key' }
  )

  const lastDate = summaries[summaries.length - 1]?.date ?? ''

  useEffect(() => {
    if (settings.privateModeActive) {
      setState({ status: 'private_mode' })
      return
    }

    if (!settings.openrouterApiKey) {
      setState({ status: 'no_key' })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })

    fetchWeeklyInsight(summaries, goals, settings, controller.signal)
      .then(text => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', text })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'error' })
        }
      })

    return () => {
      controller.abort()
    }
    // Re-run when number of summaries, last date, API key, or private mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries.length, lastDate, settings.openrouterApiKey, settings.privateModeActive])

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Weekly Insight</h3>

      {state.status === 'private_mode' && (
        <p className="text-sm text-slate-400">
          Weekly insight is paused in Private Mode.
        </p>
      )}

      {state.status === 'no_key' && (
        <p className="text-sm text-slate-400">
          Add your OpenRouter API key in Settings to get weekly insights.
        </p>
      )}

      {state.status === 'loading' && <LoadingState />}

      {state.status === 'loaded' && (
        <p className="text-sm text-slate-200 leading-relaxed">{state.text}</p>
      )}

      {state.status === 'error' && (
        <p className="text-sm text-slate-400">
          Weekly insight unavailable right now.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component — early-return guard here to keep hooks in card clean
// ---------------------------------------------------------------------------
export function WeeklyInsight(props: Props) {
  // Consistent with WeeklyReport: hide below 2 summaries
  if (props.summaries.length < 2) return null
  return <WeeklyInsightCard {...props} />
}
