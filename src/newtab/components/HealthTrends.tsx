import type { DailySummary } from '../../shared/types'
import { computeHealthTrends, type MetricTrend } from '../healthTrends'

interface Props {
  summaries: DailySummary[]
}

function fmtAvg(key: MetricTrend['key'], avg: number): string {
  if (key === 'screenTime') {
    const m = Math.round(avg / 60)
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
  }
  if (key === 'lateNight') return `${avg}m`
  return `${avg}`
}

function arrow(t: MetricTrend): { glyph: string; color: string } {
  if (t.direction === 'flat') return { glyph: '→', color: '#7b8aa3' }
  const healthy = (t.direction === 'down') === t.goodWhenDown
  const glyph = t.direction === 'up' ? '↑' : '↓'
  return { glyph, color: healthy ? '#34d399' : '#f7b955' }
}

function weekday(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-[2px]"
          style={{
            height: `${Math.max(3, (v / max) * 100)}%`,
            background: i === values.length - 1 ? '#34d399' : 'rgba(52,211,153,0.32)',
          }}
        />
      ))}
    </div>
  )
}

export function HealthTrends({ summaries }: Props) {
  if (summaries.length < 2) return null
  const trends = computeHealthTrends(summaries)

  return (
    <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Health Trends</h3>
        <span className="text-[11.5px] text-ink-600">last {trends.days} days</span>
      </div>

      <div className="space-y-3">
        {trends.metrics.map(t => {
          const a = arrow(t)
          return (
            <div key={t.key} className="flex items-center gap-3">
              <span className="w-24 flex-shrink-0 text-[12.5px] text-ink-400">{t.label}</span>
              <div className="min-w-0 flex-1"><Bars values={t.values} /></div>
              <span className="w-16 flex-shrink-0 text-right text-[12.5px] tabular-nums text-ink-300">
                {fmtAvg(t.key, t.average)}
              </span>
              <span className="w-4 flex-shrink-0 text-right text-sm font-bold" style={{ color: a.color }}>
                {a.glyph}
              </span>
            </div>
          )
        })}
      </div>

      {trends.best && trends.worst && trends.best.date !== trends.worst.date && (
        <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11.5px] text-ink-600">
          Best day: <span className="text-health">{weekday(trends.best.date)} {trends.best.score}</span>
          {' · '}Hardest: <span className="text-shorts">{weekday(trends.worst.date)} {trends.worst.score}</span>
        </p>
      )}
    </div>
  )
}
