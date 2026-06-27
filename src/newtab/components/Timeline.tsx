import type { Visit } from '../../shared/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'

interface Props { visits: Visit[] }

export function Timeline({ visits }: Props) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const byHour: Record<number, Visit[]> = {}
  for (const v of visits) {
    const h = new Date(v.startTime).getHours()
    byHour[h] = [...(byHour[h] ?? []), v]
  }

  const maxSec = Math.max(...Object.values(byHour).map(vs => vs.reduce((s, v) => s + v.duration, 0)), 1)

  return (
    <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Today's Timeline</h3>
      <div className="flex items-end gap-px h-24 overflow-x-auto">
        {hours.map(h => {
          const hvs = byHour[h] ?? []
          const total = hvs.reduce((s, v) => s + v.duration, 0)
          const heightPct = (total / maxSec) * 100
          const topCategory = [...hvs].sort((a, b) => b.duration - a.duration)[0]?.category

          return (
            <div key={h} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${heightPct}%`,
                  minHeight: total > 0 ? 2 : 0,
                  background: topCategory ? CATEGORY_COLORS[topCategory] : 'transparent',
                }}
              />
              {total > 0 && (
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 whitespace-nowrap z-10">
                  {h}:00 — {topCategory ? CATEGORY_LABELS[topCategory] : ''} {Math.round(total / 60)}m
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
      </div>
    </div>
  )
}
