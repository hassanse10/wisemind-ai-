import { useState, useEffect } from 'react'
import type { DailySummary, ExtensionSettings, Category } from '../../shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  summary: DailySummary
  settings: ExtensionSettings
}

type State =
  | { status: 'no_key' }
  | { status: 'private_mode' }
  | { status: 'loading' }
  | { status: 'loaded'; items: string[] }
  | { status: 'error' }

// ---------------------------------------------------------------------------
// Personality tones (mirrors CoachingEngine)
// ---------------------------------------------------------------------------
const PERSONALITY_TONES: Record<string, string> = {
  wise: 'Calm, thoughtful, like an experienced mentor. Ask reflective questions.',
  friendly: 'Relaxed, positive, encouraging, casual language.',
  coach: 'Disciplined, direct, challenges excuses, motivates action.',
  mindful: 'Peaceful, focuses on breathing and stress reduction.',
  funny: 'Playful, uses light humour, never mean-spirited.',
}

// ---------------------------------------------------------------------------
// OpenRouter fetch
// ---------------------------------------------------------------------------
async function fetchRecommendations(
  summary: DailySummary,
  settings: ExtensionSettings,
  signal: AbortSignal
): Promise<string[]> {
  const tone =
    PERSONALITY_TONES[settings.mentorPersonality] ?? PERSONALITY_TONES.wise

  const system =
    `You are a digital wellness coach inside a Chrome extension. ` +
    `Tone: ${tone}. ` +
    `Return ONLY a JSON object with this exact shape: { "recommendations": ["...", "...", "..."] }. ` +
    `Provide exactly 3 short, concrete, actionable suggestions based on the user's day. ` +
    `Never shame the user. Never start any suggestion with "I".`

  // Build a compact user snapshot (seconds → minutes for readability)
  const topCategories = (Object.entries(summary.byCategory) as [Category, number][])
    .filter(([, secs]) => secs > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .reduce<Record<string, number>>((acc, [cat, secs]) => {
      acc[cat] = Math.round(secs / 60)
      return acc
    }, {})

  const userContent = JSON.stringify({
    healthScore: summary.healthScore,
    productivityScore: summary.productivityScore,
    learningScore: summary.learningScore,
    topCategoriesMinutes: topCategories,
    shortVideoCount: summary.shortVideoCount,
    lateNightMinutes: summary.lateNightMinutes,
    breaks: summary.breaks,
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
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) throw new Error(`OpenRouter responded with ${res.status}`)

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = data.choices?.[0]?.message?.content ?? ''
  const parsed = JSON.parse(raw) as { recommendations?: unknown }

  if (!Array.isArray(parsed.recommendations)) {
    throw new Error('Unexpected response shape')
  }

  return (parsed.recommendations as unknown[])
    .filter((r): r is string => typeof r === 'string')
    .slice(0, 3)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading recommendations">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="h-12 bg-slate-700/40 rounded-xl animate-pulse"
        />
      ))}
    </div>
  )
}

function RecommendationCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 bg-slate-700/30 rounded-xl p-4">
      <span className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-blue-400 mt-1.5" aria-hidden="true" />
      <p className="text-sm text-slate-200 leading-relaxed">{text}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function Recommendations({ summary, settings }: Props) {
  const [state, setState] = useState<State>(
    settings.privateModeActive
      ? { status: 'private_mode' }
      : settings.openrouterApiKey
        ? { status: 'loading' }
        : { status: 'no_key' }
  )

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

    fetchRecommendations(summary, settings, controller.signal)
      .then(items => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', items })
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
    // Re-run when the date, API key, or private mode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.date, settings.openrouterApiKey, settings.privateModeActive])

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Today's Recommendations</h3>

      {state.status === 'private_mode' && (
        <p className="text-sm text-slate-400">
          Recommendations are paused in Private Mode.
        </p>
      )}

      {state.status === 'no_key' && (
        <p className="text-sm text-slate-400">
          Add your OpenRouter API key in Settings to get daily recommendations.
        </p>
      )}

      {state.status === 'loading' && <LoadingState />}

      {state.status === 'loaded' && (
        <div className="space-y-3">
          {state.items.map((rec, idx) => (
            <RecommendationCard key={idx} text={rec} />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="text-sm text-slate-400">
          Recommendations unavailable right now.
        </p>
      )}
    </div>
  )
}
