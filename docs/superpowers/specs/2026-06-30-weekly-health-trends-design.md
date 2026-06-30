# Weekly Health Trends — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)
**Feature:** Fifth and final of the health-features series (break timer ✓ → bedtime wind-down ✓ → posture/hydration nudges ✓ → breathing reset ✓ → **weekly health trends**). Covers only this feature.

## Goal

A dashboard "Health Trends" panel that charts the *drivers* behind the Health score over the last 14 days — late-night minutes, breaks/day, daily screen time, and the Health score itself — as mini per-day bar charts with averages, trend arrows, and the best/worst day. Makes the abstract Health score concrete over time. Frontend-only: no background engine, no storage, no settings, no scoring changes.

## Decisions (from brainstorming)

- **Focus:** the health *drivers* behind the score (distinct from the existing panels).
- **Metrics:** late-night minutes, breaks/day, daily screen time, Health score.
- **Window:** 14 days (already loaded by the dashboard; differentiates from the 7-day `WeeklyReport`).
- **Visualization:** mini per-day bar charts (one row per metric: label · 14 bars · average · trend arrow), today/newest brighter, plus a best/worst-day footer.
- **Trend:** compare the recent-half average to the older-half average (recent 7 vs prior 7 when 14 days exist), with a small epsilon → `flat`.
- **Best/worst:** highest / lowest `healthScore` day.

## Existing context this builds on

- The dashboard (`src/newtab/App.tsx`) already loads `weeklySummaries` via `getLastNDailySummaries(14)` — this feature reuses that array; no new data fetching.
- `DailySummary` (`src/shared/types.ts`) provides per-day: `date`, `totalTime` (seconds), `breaks`, `lateNightMinutes`, `healthScore` (plus others). These four fields back the metrics.
- Existing weekly panels: `WeeklyReport` (7-day sparklines of the three composite scores) and `WeeklyInsight` (AI text). This panel complements both — it charts the underlying health behaviors, which neither shows.
- `WeeklyReport` returns `null` when `summaries.length < 2`; this panel follows the same guard.
- Theme tokens (`bg-white/[0.025]`, `text-ink-*`/`text-slate-*`, `wm-panel`) and the `Sparkline` pattern live in the dashboard components.

## Component 1: Pure trends module (`src/newtab/healthTrends.ts`)

The testable core — no DOM, no Chrome:

```ts
import type { DailySummary } from '../shared/types'

export type MetricKey = 'lateNight' | 'breaks' | 'screenTime' | 'health'
export type TrendDirection = 'up' | 'down' | 'flat'

export interface MetricTrend {
  key: MetricKey
  label: string
  values: number[]        // per-day, oldest→newest; raw units (minutes / count / seconds / score)
  average: number         // mean of values (rounded)
  direction: TrendDirection
  goodWhenDown: boolean   // lateNight & screenTime: down is good; breaks & health: up is good
}

export interface HealthTrends {
  days: number            // number of days charted (<= 14)
  metrics: MetricTrend[]  // [lateNight, breaks, screenTime, health]
  best: { date: string; score: number } | null
  worst: { date: string; score: number } | null
}

export function computeHealthTrends(summaries: DailySummary[]): HealthTrends
```

Behavior:
- Sort `summaries` ascending by `date`, take the last 14 → `window`.
- `days = window.length`.
- For each metric, build `values` from `window`: `lateNight` ← `lateNightMinutes`; `breaks` ← `breaks`; `screenTime` ← `totalTime`; `health` ← `healthScore`.
- `average = round(mean(values))` (0 when empty).
- `direction`: split `values` into older and recent halves (`recent = values.slice(ceil(n/2))`, `older = values.slice(0, floor(n/2))`); compare `mean(recent)` vs `mean(older)`. If either half is empty (n < 2) → `flat`. Else `flat` when the absolute difference is within an epsilon (`max(1, 5% of the older mean)`), otherwise `up` / `down`. (Epsilon avoids noise on tiny counts like breaks.)
- `goodWhenDown`: `true` for `lateNight` and `screenTime`; `false` for `breaks` and `health`.
- `best` / `worst`: the `window` day with the highest / lowest `healthScore` (`{ date, score: healthScore }`); both `null` when `window` is empty.
- Labels: `lateNight` → "Late-night", `breaks` → "Breaks/day", `screenTime` → "Screen time", `health` → "Health score".

Deterministic and fully unit-tested.

## Component 2: The panel (`src/newtab/components/HealthTrends.tsx`)

```ts
interface Props { summaries: DailySummary[] }
```
- Returns `null` when `summaries.length < 2` (matches `WeeklyReport`).
- Calls `computeHealthTrends(summaries)`.
- Renders a card (`bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5`) titled "Health Trends".
- One row per metric: the `label`, a horizontal strip of `values.length` bars (each bar height/length scaled to that metric's own max, `max(...values, 1)`), with the **last bar (today/newest) rendered brighter**; the formatted `average`; and a trend arrow.
  - Bar color: a neutral metric tint; today's bar brighter.
  - Arrow: `↑`/`↓`/`→` from `direction`; colored **green** when the move is healthy (`direction === 'down' && goodWhenDown`, or `direction === 'up' && !goodWhenDown`), **amber** when unhealthy, neutral when `flat`.
- Average formatting (in the component): `lateNight`/`breaks` → `${n}m` / `${n}`; `screenTime` → `Xh Ym` (from seconds); `health` → the integer.
- Footer line when `best`/`worst` exist and differ: "Best day: <weekday> <score> · Hardest: <weekday> <score>" (weekday from `new Date(date)`).

Pure presentational; reuses existing styling. No new icons/deps.

## Component 3: Dashboard wiring (`src/newtab/App.tsx`)

Add the import and render `<HealthTrends summaries={weeklySummaries} />` immediately after the existing `<WeeklyReport summaries={weeklySummaries} />` line. No other changes; `weeklySummaries` is already in scope.

## Edge cases

- Fewer than 2 days of data → panel renders nothing (guard).
- 2–13 days → charts however many days exist (bars = `values.length`); halves still split correctly.
- All-zero metric (e.g. no late-night time) → bars at baseline, average 0, `flat` direction; no divide-by-zero (bar max clamped to 1; epsilon uses `max(1, …)`).
- `best`/`worst` identical (one day, or all equal scores) → footer omitted when they coincide.

## Testing

- `src/newtab/healthTrends.test.ts`: `computeHealthTrends` over small `DailySummary` fixtures — correct per-metric `values` extraction and `average`; `direction` `up`/`down`/`flat` including the epsilon boundary; `goodWhenDown` flags per metric; `best`/`worst` selection by `healthScore`; the `days` count and the `< 2 days` empty case (`metrics` present with empty values, `best`/`worst` null).
- `src/newtab/components/HealthTrends.test.tsx` (light): renders the four metric labels and at least one formatted average for a ≥2-day fixture; returns nothing for a single-day fixture.

No engine / settings / storage / scoring tests (none changed).

## Out of scope

This is the final feature in the series; nothing deferred.
