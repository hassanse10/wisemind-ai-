import type { DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

export function ShortVideoReport({ summary }: Props) {
  const minutes = Math.round(summary.shortVideoDuration / 60)
  return (
    <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-amber-400 mb-3">Short Videos</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold text-slate-100">{summary.shortVideoCount}</p>
          <p className="text-xs text-slate-500 mt-1">videos watched</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-100">{minutes}m</p>
          <p className="text-xs text-slate-500 mt-1">total duration</p>
        </div>
      </div>
    </div>
  )
}
