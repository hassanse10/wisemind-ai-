import type { DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

export function ShortVideoReport({ summary }: Props) {
  const minutes = Math.round(summary.shortVideoDuration / 60)
  return (
    <div className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base text-[#362b1a]">Short Video Report</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl text-[#b85c38]">{summary.shortVideoCount}</span>
          <span className="text-xs text-[#7a6a4f] font-bold">today</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-display text-3xl text-[#b85c38]">{summary.shortVideoCount}</p>
          <p className="text-xs text-[#7a6a4f] mt-1">videos watched</p>
        </div>
        <div>
          <p className="font-display text-3xl text-[#b85c38]">{minutes}m</p>
          <p className="text-xs text-[#7a6a4f] mt-1">total duration</p>
        </div>
      </div>
      <div className="mt-4 p-3 rounded-xl bg-[#eef0e0] border-[1.5px] border-[#4d7c57] text-sm text-[#2f5238] font-semibold leading-snug">
        Keep track of your short video habits daily.
      </div>
    </div>
  )
}
