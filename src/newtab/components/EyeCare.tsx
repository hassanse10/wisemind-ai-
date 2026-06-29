import { useMemo, useState } from 'react'
import type { DailySummary } from '../../shared/types'

interface Props {
  summary: DailySummary
}

interface Tip {
  icon: string
  title: string
  detail: string
}

// A broad set of eye-relief & screen-wellness propositions.
const TIPS: Tip[] = [
  { icon: '👁️', title: '20-20-20 rule', detail: 'Every 20 minutes, look at something 20 feet away for 20 seconds to relax your focusing muscles.' },
  { icon: '😌', title: 'Palming', detail: 'Rub your palms warm, cup them gently over closed eyes for 30–60s. Total darkness soothes strain.' },
  { icon: '💧', title: 'Blink on purpose', detail: 'Screens cut your blink rate by half. Do 10 slow, full blinks to re-spread your tear film.' },
  { icon: '🔭', title: 'Distance gazing', detail: 'Walk to a window and trace the furthest object you can see for a minute to reset near-focus fatigue.' },
  { icon: '🌀', title: 'Eye rolls', detail: 'Slowly roll your eyes clockwise 5× then counter-clockwise 5× to loosen the surrounding muscles.' },
  { icon: '☀️', title: 'Step into daylight', detail: 'A few minutes of natural light eases eye strain and helps regulate your sleep rhythm.' },
  { icon: '🔅', title: 'Match your brightness', detail: 'Set screen brightness to match the room — a glowing screen in a dark room strains the eyes most.' },
  { icon: '📏', title: 'Arm’s-length rule', detail: 'Keep the screen about an arm’s length away and just below eye level to relax neck and eyes.' },
  { icon: '🚶', title: 'Micro-walk', detail: 'A 2-minute walk every half hour rests your eyes, back, and refocuses your attention.' },
  { icon: '🫖', title: 'Hydrate', detail: 'Dry eyes worsen with dehydration. A glass of water helps your tear film stay stable.' },
  { icon: '🌙', title: 'Warm the screen at night', detail: 'Enable a warm/night colour filter after dark to cut blue light and ease late-session strain.' },
  { icon: '🧘', title: 'Figure-8 tracing', detail: 'Imagine a sideways 8 about 3m away and trace it slowly with your eyes for 30s each direction.' },
]

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmtMin(sec: number): string {
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export function EyeCare({ summary }: Props) {
  // Rotate the order each visit so the list stays fresh.
  const [seed, setSeed] = useState(() => Math.floor(Date.now() / 60000))
  const tips = useMemo(() => shuffle(TIPS, seed), [seed])

  const featured = tips[0]
  const rest = tips.slice(1)

  // A small data-aware nudge above the list.
  const heavyDay = summary.totalTime >= 2 * 3600
  const lateNight = summary.lateNightMinutes >= 30
  const nudge = lateNight
    ? `You logged ${fmtMin(summary.lateNightMinutes * 60)} of late-night screen time — warm the screen and rest your eyes before bed.`
    : heavyDay
      ? `That's ${fmtMin(summary.totalTime)} of screen time today — your eyes have earned a real break.`
      : 'Small, frequent breaks keep your eyes comfortable through the day.'

  return (
    <div className="wm-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-300">Rest Your Eyes</h3>
        <button
          onClick={() => setSeed(s => s + 1)}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] font-medium text-ink-500 transition-colors hover:bg-white/[0.06]"
        >
          ↻ Shuffle
        </button>
      </div>

      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-500">{nudge}</p>

      {/* Featured proposition */}
      <div
        className="mb-3 flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(52,211,153,.07)', border: '1px solid rgba(52,211,153,.18)' }}
      >
        <span className="text-2xl leading-none" aria-hidden="true">{featured.icon}</span>
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-display text-[14px] font-semibold text-ink-100">{featured.title}</span>
            <span className="rounded-full bg-health/15 px-1.5 py-px text-[10px] font-semibold text-health">Try now</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-400">{featured.detail}</p>
        </div>
      </div>

      {/* Remaining propositions */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rest.map(tip => (
          <div key={tip.title} className="flex items-start gap-2.5 rounded-xl bg-white/[0.02] p-3">
            <span className="text-lg leading-none" aria-hidden="true">{tip.icon}</span>
            <div>
              <div className="text-[12.5px] font-semibold text-ink-200">{tip.title}</div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-600">{tip.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
