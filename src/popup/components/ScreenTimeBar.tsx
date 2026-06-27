import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'
import type { Category, DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

export function ScreenTimeBar({ summary }: Props) {
  const total = summary.totalTime || 1
  const entries = Object.entries(summary.byCategory)
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6) as [Category, number][]

  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {entries.map(([cat, sec]) => (
          <div key={cat} style={{ width: `${(sec / total) * 100}%`, background: CATEGORY_COLORS[cat] }}
            title={`${CATEGORY_LABELS[cat]}: ${Math.round(sec / 60)}m`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {entries.map(([cat, sec]) => (
          <span key={cat} className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
            {CATEGORY_LABELS[cat]} {Math.round(sec / 60)}m
          </span>
        ))}
      </div>
    </div>
  )
}
