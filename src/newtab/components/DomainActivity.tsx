import { useState } from 'react'
import type { Category, Visit } from '../../shared/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'

interface Props {
  visits: Visit[]
}

interface DomainRow {
  domain: string
  duration: number
  visits: number
  category: Category
  topTitle: string
}

function fmt(totalSec: number): string {
  const m = Math.round(totalSec / 60)
  if (m < 1) return '<1m'
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

function aggregate(visits: Visit[]): DomainRow[] {
  const map = new Map<string, DomainRow & { _longest: number }>()
  for (const v of visits) {
    if (!v.domain) continue
    const row = map.get(v.domain) ?? {
      domain: v.domain,
      duration: 0,
      visits: 0,
      category: v.category,
      topTitle: v.title,
      _longest: 0,
    }
    row.duration += v.duration
    row.visits += 1
    // category & representative title follow the longest single visit
    if (v.duration > row._longest) {
      row._longest = v.duration
      row.category = v.category
      row.topTitle = v.title || row.topTitle
    }
    map.set(v.domain, row)
  }
  return [...map.values()]
    .map(({ _longest, ...r }) => r)
    .sort((a, b) => b.duration - a.duration)
}

export function DomainActivity({ visits }: Props) {
  const [expanded, setExpanded] = useState(false)
  const rows = aggregate(visits)

  if (rows.length === 0) {
    return (
      <div className="bg-[#faf5e9] border-2 border-[#362b1a] rounded-[20px] p-5"
        style={{ boxShadow: '6px 8px 0 rgba(54,43,26,.18)' }}>
        <h3 className="font-display mb-2 text-sm font-semibold text-ink-200">Activity by Domain</h3>
        <p className="text-sm text-ink-500">No browsing tracked yet today.</p>
      </div>
    )
  }

  const maxDuration = rows[0].duration || 1
  const shown = expanded ? rows : rows.slice(0, 6)

  return (
    <div className="bg-[#faf5e9] border-2 border-[#362b1a] rounded-[20px] p-5"
      style={{ boxShadow: '6px 8px 0 rgba(54,43,26,.18)' }}>
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold text-ink-200">Activity by Domain</h3>
        <span className="text-[11.5px] text-ink-500">{rows.length} site{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="space-y-2">
        {shown.map((row, i) => {
          const color = CATEGORY_COLORS[row.category]
          const barPct = Math.round((row.duration / maxDuration) * 100)
          return (
            <div key={row.domain} className="flex items-center gap-3 rounded-[16px] bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] px-3 py-2.5">
              <span className="w-4 flex-shrink-0 text-center text-[12px] tabular-nums text-ink-500">{i + 1}</span>
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-bold uppercase"
                style={{ background: `${color}22`, color }}
                aria-hidden="true"
              >
                {row.domain[0] ?? '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink-200">{row.domain}</span>
                  <span
                    className="flex-shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium"
                    style={{ background: `${color}1f`, color }}
                  >
                    {CATEGORY_LABELS[row.category]}
                  </span>
                </div>
                <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-[rgba(54,43,26,.1)]">
                  <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: color }} />
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[12.5px] font-semibold tabular-nums text-ink-200">{fmt(row.duration)}</div>
                <div className="text-[10.5px] tabular-nums text-ink-500">{row.visits} visit{row.visits === 1 ? '' : 's'}</div>
              </div>
            </div>
          )
        })}
      </div>

      {rows.length > 6 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 w-full rounded-[20px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-transparent py-2 text-[12.5px] font-medium text-ink-500 transition-colors hover:bg-[rgba(54,43,26,.05)]"
        >
          {expanded ? 'Show less' : `Show all ${rows.length} sites`}
        </button>
      )}
    </div>
  )
}
