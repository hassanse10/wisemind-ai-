import type { Goal, DailySummary } from '../../shared/types'
import { CATEGORY_LABELS } from '../../shared/constants'
import type { Category } from '../../shared/types'

interface Props { goals: Goal[]; summary: DailySummary }

export function GoalsProgress({ goals, summary }: Props) {
  if (goals.length === 0) return null

  return (
    <div className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-2xl p-5">
      <h3 className="font-display text-base text-[#362b1a] mb-4">Goals Progress</h3>
      <div className="space-y-4">
        {goals.map(g => {
          const cat = g.target as Category
          const usedMin = Math.round((summary.byCategory[cat] ?? 0) / 60)
          const limit = g.dailyLimitMinutes ?? 120
          const pct = Math.min(100, Math.round((usedMin / limit) * 100))
          const over = usedMin > limit

          return (
            <div key={g.id}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#463a25] font-bold">{CATEGORY_LABELS[cat] ?? g.target}</span>
                <span className={over ? 'text-[#96650f] font-extrabold' : 'text-[#2f5238] font-extrabold'}>{usedMin}m / {limit}m</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(54,43,26,.1)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: over ? '#c9892f' : '#4d7c57' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
