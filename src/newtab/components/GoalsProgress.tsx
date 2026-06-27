import type { Goal, DailySummary } from '../../shared/types'
import { CATEGORY_LABELS } from '../../shared/constants'
import type { Category } from '../../shared/types'

interface Props { goals: Goal[]; summary: DailySummary }

export function GoalsProgress({ goals, summary }: Props) {
  if (goals.length === 0) return null

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Goals</h3>
      <div className="space-y-4">
        {goals.map(g => {
          const cat = g.target as Category
          const usedMin = Math.round((summary.byCategory[cat] ?? 0) / 60)
          const limit = g.dailyLimitMinutes ?? 120
          const pct = Math.min(100, Math.round((usedMin / limit) * 100))
          const over = usedMin > limit

          return (
            <div key={g.id}>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{CATEGORY_LABELS[cat] ?? g.target}</span>
                <span className={over ? 'text-red-400' : 'text-slate-400'}>{usedMin}m / {limit}m</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
