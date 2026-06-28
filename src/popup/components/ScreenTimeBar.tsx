import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'
import type { Category, DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

function fmt(totalSec: number): string {
  const m = Math.round(totalSec / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

export function ScreenTimeBar({ summary }: Props) {
  const total = summary.totalTime || 1
  const entries = Object.entries(summary.byCategory)
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6) as [Category, number][]

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-ink-600">SCREEN TIME TODAY</span>
        <span className="font-display text-sm font-semibold text-ink-300">{fmt(summary.totalTime)}</span>
      </div>
      <div className="flex h-[9px] gap-[3px]">
        {entries.map(([cat, sec]) => (
          <div
            key={cat}
            className="rounded"
            style={{ flex: (sec / total) * 100, background: CATEGORY_COLORS[cat] }}
            title={`${CATEGORY_LABELS[cat]}: ${Math.round(sec / 60)}m`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
        {entries.map(([cat]) => (
          <span key={cat} className="flex items-center gap-1.5 text-[11px] text-ink-500">
            <i className="h-[7px] w-[7px] rounded-[2px]" style={{ background: CATEGORY_COLORS[cat] }} />
            {CATEGORY_LABELS[cat]}
          </span>
        ))}
      </div>
    </div>
  )
}
