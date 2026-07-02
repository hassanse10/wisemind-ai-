import type { Category, DailySummary, Visit } from '../../shared/types'
import { CATEGORY_COLORS, CATEGORY_LABELS, PRODUCTIVE_CATEGORIES } from '../../shared/constants'

interface Props {
  summary: DailySummary
  visits: Visit[]
}

function fmt(totalSec: number): string {
  const m = Math.round(totalSec / 60)
  if (m < 1) return '<1m'
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export function ScreenTimeDetails({ summary, visits }: Props) {
  const total = summary.totalTime || 1

  const entries = (Object.entries(summary.byCategory) as [Category, number][])
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1])

  // Derived session stats
  const sessionCount = visits.length
  const longest = visits.reduce((max, v) => (v.duration > max.duration ? v : max), { duration: 0 } as Visit)
  const avgSession = sessionCount > 0 ? summary.totalTime / sessionCount : 0
  const productiveSec = PRODUCTIVE_CATEGORIES.reduce((s, c) => s + (summary.byCategory[c] ?? 0), 0)
  const focusPct = Math.round((productiveSec / total) * 100)

  const stats: Array<{ label: string; value: string; tint: string }> = [
    { label: 'Total today', value: fmt(summary.totalTime), tint: 'var(--color-ink-100)' },
    { label: 'Focus share', value: `${focusPct}%`, tint: 'var(--color-prod)' },
    { label: 'Sessions', value: String(sessionCount), tint: 'var(--color-ink-100)' },
    { label: 'Avg session', value: fmt(avgSession), tint: 'var(--color-ink-100)' },
    { label: 'Breaks taken', value: String(summary.breaks), tint: 'var(--color-health)' },
    { label: 'Late-night', value: fmt(summary.lateNightMinutes * 60), tint: 'var(--color-shorts)' },
  ]

  return (
    <div className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-[18px] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-base text-[#362b1a]">Screen Time Details</h3>
        <span className="font-display text-sm text-[#5d5138]">{fmt(summary.totalTime)}</span>
      </div>

      {/* Full-width stacked bar */}
      <div className="flex h-[10px] gap-[3px] overflow-hidden rounded">
        {entries.map(([cat, sec]) => (
          <div
            key={cat}
            style={{ flex: sec, background: CATEGORY_COLORS[cat] }}
            title={`${CATEGORY_LABELS[cat]}: ${fmt(sec)}`}
          />
        ))}
      </div>

      {/* Per-category rows */}
      <div className="mt-4 space-y-2.5">
        {entries.map(([cat, sec]) => {
          const pct = Math.round((sec / total) * 100)
          return (
            <div key={cat} className="flex items-center gap-3">
              <i className="h-[9px] w-[9px] flex-shrink-0 rounded-[3px]" style={{ background: CATEGORY_COLORS[cat] }} />
              <span className="w-28 flex-shrink-0 text-[12.5px] text-[#463a25]">{CATEGORY_LABELS[cat]}</span>
              <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-[rgba(54,43,26,.1)]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat] }} />
              </div>
              <span className="w-16 flex-shrink-0 text-right text-[12.5px] tabular-nums text-[#7a6a4f]">{fmt(sec)}</span>
              <span className="w-9 flex-shrink-0 text-right text-[11.5px] tabular-nums text-[#8a7a5c]">{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Session stat grid */}
      <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-[rgba(54,43,26,.1)] pt-4">
        {stats.map(({ label, value, tint }) => (
          <div key={label} className="rounded-xl bg-[#f3ecd9] px-3 py-2.5">
            <div className="font-display text-base" style={{ color: tint }}>{value}</div>
            <div className="mt-0.5 text-[11px] text-[#8a7a5c]">{label}</div>
          </div>
        ))}
      </div>

      {longest.duration > 0 && longest.domain && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#8a7a5c]">
          Longest single stretch: <span className="text-[#5d5138]">{fmt(longest.duration)}</span> on{' '}
          <span className="text-[#5d5138]">{longest.domain}</span>.
        </p>
      )}
    </div>
  )
}
