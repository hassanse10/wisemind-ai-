import type { DailySummary } from '../../shared/types'

interface Props { summaries: DailySummary[] }

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 100, h = 32
  const count = values.length
  if (count < 2) return null
  const pts = values.map((v, i) => `${(i / (count - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  )
}

export function WeeklyReport({ summaries }: Props) {
  if (summaries.length < 2) return null
  const sorted = [...summaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)

  const thisWeekLearn = sorted.reduce((s, d) => s + (d.byCategory['learning'] ?? 0), 0)
  const prevWeekSummaries = [...summaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14, -7)
  const lastWeekLearn = prevWeekSummaries.reduce((s, d) => s + (d.byCategory['learning'] ?? 0), 0)
  const learningDiff = lastWeekLearn > 0 ? Math.round(((thisWeekLearn - lastWeekLearn) / lastWeekLearn) * 100) : 0

  return (
    <div className="bg-[#faf5e9] border-2 border-[#362b1a] rounded-[20px] p-5"
      style={{ boxShadow: '6px 8px 0 rgba(54,43,26,.18)' }}>
      <h3 className="font-display text-sm font-semibold text-ink-200 mb-4">Weekly Trends</h3>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Learning', color: '#c9892f', values: sorted.map(d => d.learningScore) },
          { label: 'Productivity', color: '#58789f', values: sorted.map(d => d.productivityScore) },
          { label: 'Health', color: '#4d7c57', values: sorted.map(d => d.healthScore) },
        ].map(({ label, color, values }) => (
          <div key={label} className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-[16px] p-3">
            <p className="text-xs text-ink-500 mb-1">{label}</p>
            <Sparkline values={values} color={color} />
            <p className="font-display text-lg font-bold mt-1" style={{ color }}>
              {Math.round(values.reduce((a, b) => a + b, 0) / values.length)}
            </p>
          </div>
        ))}
      </div>
      {learningDiff !== 0 && (
        <p className="text-xs mt-3 text-ink-500">
          Learning {learningDiff > 0 ? '↑' : '↓'}{Math.abs(learningDiff)}% vs last week
        </p>
      )}
    </div>
  )
}
