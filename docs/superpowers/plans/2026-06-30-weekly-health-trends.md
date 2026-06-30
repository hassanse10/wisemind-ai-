# Weekly Health Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard "Health Trends" panel charting the drivers behind the Health score over the last 14 days (late-night minutes, breaks/day, screen time, Health score) as mini per-day bar charts with averages, trend arrows, and best/worst day.

**Architecture:** A pure `src/newtab/healthTrends.ts` computes per-metric series, averages, trend direction, and best/worst day from the already-loaded 14-day `DailySummary[]` (the unit-tested core). A presentational `HealthTrends.tsx` renders it, wired into the dashboard next to `WeeklyReport`. Frontend-only: no engine, storage, settings, or scoring changes.

**Tech Stack:** TypeScript, React, Vitest, React Testing Library.

## Global Constraints

- No background/engine/storage/settings/scoring changes; reuse the dashboard's already-loaded `weeklySummaries` (`getLastNDailySummaries(14)`).
- Metrics, in order: `lateNight` (from `lateNightMinutes`), `breaks` (from `breaks`), `screenTime` (from `totalTime`, seconds), `health` (from `healthScore`).
- `goodWhenDown`: `true` for `lateNight` and `screenTime`; `false` for `breaks` and `health`.
- Trend direction: compare the recent half's mean to the older half's; `flat` within an epsilon of `max(1, 5% of the older mean)`, else `up`/`down`. `flat` when fewer than 2 values.
- `best`/`worst` = highest/lowest `healthScore` day in the window.
- The panel returns `null` when `summaries.length < 2` (matches `WeeklyReport`).
- Reuse existing dashboard card styling (`bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5`) and theme tokens (`text-ink-*`, `text-slate-*`, `text-health`, `text-shorts`, `#34d399`). No new dependencies.

---

### Task 1: Pure trends module

**Files:**
- Create: `src/newtab/healthTrends.ts`
- Test: `src/newtab/healthTrends.test.ts`

**Interfaces:**
- Consumes: `DailySummary` from `../shared/types` (fields `date`, `lateNightMinutes`, `breaks`, `totalTime`, `healthScore`).
- Produces:
  - `export type MetricKey = 'lateNight' | 'breaks' | 'screenTime' | 'health'`
  - `export type TrendDirection = 'up' | 'down' | 'flat'`
  - `export interface MetricTrend { key: MetricKey; label: string; values: number[]; average: number; direction: TrendDirection; goodWhenDown: boolean }`
  - `export interface HealthTrends { days: number; metrics: MetricTrend[]; best: { date: string; score: number } | null; worst: { date: string; score: number } | null }`
  - `export function computeHealthTrends(summaries: DailySummary[]): HealthTrends`

- [ ] **Step 1: Write the failing tests**

Create `src/newtab/healthTrends.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeHealthTrends } from './healthTrends'
import type { DailySummary } from '../shared/types'

function makeSummary(
  date: string,
  o: { lateNightMinutes?: number; breaks?: number; totalTime?: number; healthScore?: number } = {}
): DailySummary {
  return {
    date,
    totalTime: o.totalTime ?? 0,
    byCategory: {} as DailySummary['byCategory'],
    shortVideoCount: 0,
    shortVideoDuration: 0,
    healthScore: o.healthScore ?? 0,
    productivityScore: 0,
    learningScore: 0,
    breaks: o.breaks ?? 0,
    lateNightMinutes: o.lateNightMinutes ?? 0,
    topSites: [],
  }
}

describe('computeHealthTrends', () => {
  it('extracts per-metric values oldest→newest and sorts by date', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-11', { lateNightMinutes: 30, breaks: 2, totalTime: 3600, healthScore: 60 }),
      makeSummary('2026-06-10', { lateNightMinutes: 10, breaks: 5, totalTime: 1800, healthScore: 90 }),
    ])
    const late = t.metrics.find(m => m.key === 'lateNight')!
    expect(late.values).toEqual([10, 30]) // 06-10 then 06-11
    expect(t.metrics.find(m => m.key === 'breaks')!.values).toEqual([5, 2])
    expect(t.metrics.find(m => m.key === 'screenTime')!.values).toEqual([1800, 3600])
    expect(t.metrics.find(m => m.key === 'health')!.values).toEqual([90, 60])
    expect(t.days).toBe(2)
  })

  it('averages each metric (rounded)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { breaks: 3 }),
      makeSummary('2026-06-11', { breaks: 4 }),
      makeSummary('2026-06-12', { breaks: 4 }),
    ])
    expect(t.metrics.find(m => m.key === 'breaks')!.average).toBe(4) // 11/3 = 3.67 → 4
  })

  it('reports the correct goodWhenDown flags', () => {
    const t = computeHealthTrends([makeSummary('2026-06-10'), makeSummary('2026-06-11')])
    const byKey = Object.fromEntries(t.metrics.map(m => [m.key, m.goodWhenDown]))
    expect(byKey).toEqual({ lateNight: true, breaks: false, screenTime: true, health: false })
  })

  it('detects an upward trend (recent half higher)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 50 }),
      makeSummary('2026-06-11', { healthScore: 52 }),
      makeSummary('2026-06-12', { healthScore: 80 }),
      makeSummary('2026-06-13', { healthScore: 84 }),
    ])
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('up')
  })

  it('detects a downward trend (recent half lower)', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { lateNightMinutes: 60 }),
      makeSummary('2026-06-11', { lateNightMinutes: 58 }),
      makeSummary('2026-06-12', { lateNightMinutes: 10 }),
      makeSummary('2026-06-13', { lateNightMinutes: 8 }),
    ])
    expect(t.metrics.find(m => m.key === 'lateNight')!.direction).toBe('down')
  })

  it('reports flat when the halves are within epsilon', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 80 }),
      makeSummary('2026-06-11', { healthScore: 81 }),
      makeSummary('2026-06-12', { healthScore: 80 }),
      makeSummary('2026-06-13', { healthScore: 81 }),
    ])
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('flat')
  })

  it('picks best and worst by health score', () => {
    const t = computeHealthTrends([
      makeSummary('2026-06-10', { healthScore: 70 }),
      makeSummary('2026-06-11', { healthScore: 92 }),
      makeSummary('2026-06-12', { healthScore: 55 }),
    ])
    expect(t.best).toEqual({ date: '2026-06-11', score: 92 })
    expect(t.worst).toEqual({ date: '2026-06-12', score: 55 })
  })

  it('keeps only the last 14 days', () => {
    const summaries = Array.from({ length: 20 }, (_, i) =>
      makeSummary(`2026-06-${String(i + 1).padStart(2, '0')}`, { breaks: i })
    )
    const t = computeHealthTrends(summaries)
    expect(t.days).toBe(14)
    expect(t.metrics.find(m => m.key === 'breaks')!.values.length).toBe(14)
    expect(t.metrics.find(m => m.key === 'breaks')!.values[13]).toBe(19) // newest day kept
  })

  it('handles empty input safely', () => {
    const t = computeHealthTrends([])
    expect(t.days).toBe(0)
    expect(t.best).toBeNull()
    expect(t.worst).toBeNull()
    expect(t.metrics.find(m => m.key === 'health')!.values).toEqual([])
    expect(t.metrics.find(m => m.key === 'health')!.average).toBe(0)
    expect(t.metrics.find(m => m.key === 'health')!.direction).toBe('flat')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/newtab/healthTrends.test.ts`
Expected: FAIL — cannot import `computeHealthTrends`.

- [ ] **Step 3: Write the module**

Create `src/newtab/healthTrends.ts`:

```ts
import type { DailySummary } from '../shared/types'

export type MetricKey = 'lateNight' | 'breaks' | 'screenTime' | 'health'
export type TrendDirection = 'up' | 'down' | 'flat'

export interface MetricTrend {
  key: MetricKey
  label: string
  values: number[]       // per-day, oldest→newest; raw units
  average: number
  direction: TrendDirection
  goodWhenDown: boolean
}

export interface HealthTrends {
  days: number
  metrics: MetricTrend[]
  best: { date: string; score: number } | null
  worst: { date: string; score: number } | null
}

interface MetricDef {
  key: MetricKey
  label: string
  goodWhenDown: boolean
  pick: (s: DailySummary) => number
}

const METRICS: MetricDef[] = [
  { key: 'lateNight', label: 'Late-night', goodWhenDown: true, pick: s => s.lateNightMinutes },
  { key: 'breaks', label: 'Breaks/day', goodWhenDown: false, pick: s => s.breaks },
  { key: 'screenTime', label: 'Screen time', goodWhenDown: true, pick: s => s.totalTime },
  { key: 'health', label: 'Health score', goodWhenDown: false, pick: s => s.healthScore },
]

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function trendDirection(values: number[]): TrendDirection {
  if (values.length < 2) return 'flat'
  const older = values.slice(0, Math.floor(values.length / 2))
  const recent = values.slice(Math.ceil(values.length / 2))
  if (older.length === 0 || recent.length === 0) return 'flat'
  const o = mean(older)
  const r = mean(recent)
  const epsilon = Math.max(1, o * 0.05)
  if (r - o > epsilon) return 'up'
  if (o - r > epsilon) return 'down'
  return 'flat'
}

export function computeHealthTrends(summaries: DailySummary[]): HealthTrends {
  const window = [...summaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-14)

  const metrics: MetricTrend[] = METRICS.map(m => {
    const values = window.map(m.pick)
    return {
      key: m.key,
      label: m.label,
      values,
      average: Math.round(mean(values)),
      direction: trendDirection(values),
      goodWhenDown: m.goodWhenDown,
    }
  })

  let best: { date: string; score: number } | null = null
  let worst: { date: string; score: number } | null = null
  for (const s of window) {
    if (best === null || s.healthScore > best.score) best = { date: s.date, score: s.healthScore }
    if (worst === null || s.healthScore < worst.score) worst = { date: s.date, score: s.healthScore }
  }

  return { days: window.length, metrics, best, worst }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/newtab/healthTrends.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/newtab/healthTrends.ts src/newtab/healthTrends.test.ts
git commit -m "feat: add pure health-trends computation module"
```

---

### Task 2: Health Trends panel + dashboard wiring

**Files:**
- Create: `src/newtab/components/HealthTrends.tsx`
- Modify: `src/newtab/App.tsx` (import + render next to `WeeklyReport`)
- Test: `src/newtab/components/HealthTrends.test.tsx`

**Interfaces:**
- Consumes: `computeHealthTrends`, `MetricTrend` from `../healthTrends` (Task 1); `DailySummary` from `../../shared/types`.
- Produces: `export function HealthTrends({ summaries }: { summaries: DailySummary[] })`.

- [ ] **Step 1: Write the failing test**

Create `src/newtab/components/HealthTrends.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthTrends } from './HealthTrends'
import type { DailySummary } from '../../shared/types'

function makeSummary(date: string, healthScore: number): DailySummary {
  return {
    date, totalTime: 3600, byCategory: {} as DailySummary['byCategory'],
    shortVideoCount: 0, shortVideoDuration: 0, healthScore,
    productivityScore: 0, learningScore: 0, breaks: 3, lateNightMinutes: 12, topSites: [],
  }
}

describe('HealthTrends', () => {
  it('renders the four metric rows for 2+ days of data', () => {
    render(<HealthTrends summaries={[makeSummary('2026-06-10', 70), makeSummary('2026-06-11', 80)]} />)
    expect(screen.getByText('Health Trends')).toBeInTheDocument()
    expect(screen.getByText('Late-night')).toBeInTheDocument()
    expect(screen.getByText('Breaks/day')).toBeInTheDocument()
    expect(screen.getByText('Screen time')).toBeInTheDocument()
    expect(screen.getByText('Health score')).toBeInTheDocument()
  })

  it('renders nothing for fewer than 2 days', () => {
    const { container } = render(<HealthTrends summaries={[makeSummary('2026-06-10', 70)]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/newtab/components/HealthTrends.test.tsx`
Expected: FAIL — cannot import `HealthTrends`.

- [ ] **Step 3: Create the component**

Create `src/newtab/components/HealthTrends.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/newtab/components/HealthTrends.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it into the dashboard**

In `src/newtab/App.tsx`, add the import with the other component imports:

```tsx
import { HealthTrends } from './components/HealthTrends'
```

Then render it immediately after the existing `WeeklyReport` line. Locate:

```tsx
        <WeeklyReport summaries={weeklySummaries} />
```

and insert directly after it:

```tsx
        <HealthTrends summaries={weeklySummaries} />
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run src/newtab && npm run build`
Expected: no type errors; newtab tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/newtab/components/HealthTrends.tsx src/newtab/components/HealthTrends.test.tsx src/newtab/App.tsx
git commit -m "feat: add Health Trends dashboard panel"
```

---

### Task 3: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + `healthTrends` + `HealthTrends`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `dist/newtab.js` emitted.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Reload `dist/` as an unpacked extension, browse a few sites across a day (or rely on existing data), then open a new tab. Verify the **Health Trends** panel appears (once 2+ days of summaries exist) showing four rows (Late-night, Breaks/day, Screen time, Health score) with per-day bars, an average, and a trend arrow (green when the move is healthy, amber otherwise), plus a "Best day / Hardest" footer.

- [ ] **Step 5: Commit (only if a tweak was needed)**

```bash
git add -A
git commit -m "chore: finalize weekly health trends"
```

---

## Self-Review

- **Spec coverage:** pure `healthTrends.ts` with `computeHealthTrends`, 4 metrics, averages, epsilon trend, best/worst, goodWhenDown, 14-day window, empty case (Task 1) ✓; `HealthTrends.tsx` panel with per-metric bars (today brighter), formatted averages, colored trend arrows, best/worst footer, `<2 days` null guard (Task 2) ✓; dashboard wiring next to `WeeklyReport` reusing `weeklySummaries` (Task 2) ✓; no engine/storage/settings/scoring change ✓.
- **Placeholder scan:** none — every code step is complete; commands have expected output.
- **Type consistency:** `computeHealthTrends(summaries) → HealthTrends { days, metrics: MetricTrend[], best, worst }` identical between Task 1 definition, its tests, and Task 2's component; `MetricTrend` fields (`key`, `label`, `values`, `average`, `direction`, `goodWhenDown`) used consistently; `MetricKey` union matches the `fmtAvg`/`arrow` switches; `HealthTrends` component prop `{ summaries: DailySummary[] }` matches the Task 2 render call.
