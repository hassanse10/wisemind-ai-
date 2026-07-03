# Popup Details & Private Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Top Sites Today" panel and a quick Private Mode toggle to the extension popup, using data and settings that already exist.

**Architecture:** Both additions live entirely in `src/popup/App.tsx` (plus its test file). Top Sites reads `settings.todaysSummary.topSites` (already computed by `ScoringEngine`) and resolves category tint client-side via the existing `categorizeDomain()` helper. The Private Mode toggle is a new header button calling the existing `updateSettings()` on the existing `privateModeActive` field. No new files, no background/engine changes, no new message types.

**Tech Stack:** TypeScript, React, Vitest, React Testing Library.

## Global Constraints

- No new data plumbing — `topSites: Array<{ domain: string; duration: number }>` and `privateModeActive: boolean` already exist on `ExtensionSettings`/`DailySummary`.
- Top Sites shows the **top 3** entries from `topSites` (already sorted descending by `ScoringEngine`).
- Category tint resolved via `categorizeDomain(domain): Category | null` (from `src/shared/constants.ts`) with `?? 'other'` fallback, then `CATEGORY_COLORS[cat]` — mirrors the exact pattern already used in `src/newtab/components/ScreenTimeDetails.tsx`.
- Empty state: when `topSites` is empty or `summary` is undefined, the Top Sites section renders nothing (same convention as the existing `{summary && summary.totalTime > 0 && <ScreenTimeBar .../>}` line already in this file).
- Private Mode toggle: header row, immediately left of the existing Settings gear button, same `h-[34px] w-[34px] rounded-full border-[1.5px]` sizing. Inactive state matches the gear button's styling exactly (`border-[rgba(54,43,26,.3)] bg-transparent text-ink-400`); active state uses the green-tint pattern (`border-[#2f5238] bg-[#eef0e0] text-[#2f5238]`).
- Toggle click: `updateSettings({ privateModeActive: !settings.privateModeActive })`; guarded so it never fires when `settings` is undefined (matches the existing `if (!settings) return <div .../>` early-return this component already has, which runs BEFORE the return statement — so by the time the header renders, `settings` is guaranteed non-null; no additional guard needed inside the button itself, but do not move the button above that early return).
- `aria-label`: `"Private mode"` when off, `"Private mode (on)"` when on.
- Visual-only-plus-one-new-handler change: do not alter any other existing behavior, prop, or text in `App.tsx`.
- After the task: `npx tsc --noEmit`, `npx vitest run src/popup`, `npm run build` (must print `[check-worker-dom] OK`).

---

### Task 1: Top Sites panel + Private Mode toggle

**Files:**
- Modify: `src/popup/App.tsx`
- Test: `src/popup/App.test.tsx`

**Interfaces:**
- Consumes: `settings.todaysSummary.topSites`, `settings.privateModeActive` (already on `ExtensionSettings`/`DailySummary`); `categorizeDomain`, `CATEGORY_COLORS` from `../shared/constants` (already exported); `updateSettings` from `../shared/StorageManager` (not currently imported in this file — add it).
- Produces: no new exports; this is a leaf UI component.

- [ ] **Step 1: Update the test mocks and write the two failing tests**

`src/popup/App.test.tsx` currently mocks `useSettings` without `privateModeActive` or `topSites` data, and does not mock `../shared/StorageManager` at all (since `App.tsx` doesn't import `updateSettings` yet). Replace the entire file with:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from './App'

const mockUpdateSettings = vi.fn()

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    todaysSummary: { healthScore: 82, productivityScore: 75, learningScore: 60,
      shortVideoCount: 23, totalTime: 14400, byCategory: {},
      topSites: [
        { domain: 'github.com', duration: 2520 },
        { domain: 'youtube.com', duration: 1800 },
        { domain: 'news.ycombinator.com', duration: 900 },
        { domain: 'example.com', duration: 60 },
      ],
      breaks: 2, lateNightMinutes: 0, shortVideoDuration: 0, date: '2026-06-27' },
    lastHealthScore: 82,
    privateModeActive: false,
  }),
}))
vi.mock('../shared/StorageManager', () => ({
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
}))
vi.mock('../shared/hooks/useScores', () => ({ useScores: () => ({ health: 82, productivity: 75, learning: 60 }) }))
// Popup reads today's counts straight from the shared database.
vi.mock('../shared/db', () => ({
  getShortVideosByDateRange: vi.fn().mockResolvedValue([
    { id: 's1', platform: 'youtube_shorts', count: 23, duration: 600, startTime: 0, endTime: 0 },
  ]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
}))

describe('Popup App', () => {
  it('renders health score', () => {
    render(<App />)
    expect(screen.getAllByText('82').length).toBeGreaterThan(0)
  })

  it('shows live short video count from the database', async () => {
    render(<App />)
    // card only renders when the live DB count (mocked to 23) is > 0
    expect(await screen.findByText(/Shorts today/i)).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('shows the tracked-today diagnostic line', async () => {
    render(<App />)
    expect(await screen.findByText(/tracked today/i)).toBeInTheDocument()
  })

  it('shows the top 3 sites by duration, not the 4th', () => {
    render(<App />)
    expect(screen.getByText('github.com')).toBeInTheDocument()
    expect(screen.getByText('42m')).toBeInTheDocument()
    expect(screen.getByText('youtube.com')).toBeInTheDocument()
    expect(screen.getByText('news.ycombinator.com')).toBeInTheDocument()
    expect(screen.queryByText('example.com')).not.toBeInTheDocument()
  })

  it('toggles private mode when the lock button is clicked', () => {
    render(<App />)
    const btn = screen.getByRole('button', { name: 'Private mode' })
    fireEvent.click(btn)
    expect(mockUpdateSettings).toHaveBeenCalledWith({ privateModeActive: true })
  })
})
```

- [ ] **Step 2: Run tests to verify the two new ones fail**

Run: `npx vitest run src/popup/App.test.tsx`
Expected: the 3 original tests pass; the 2 new tests (`shows the top 3 sites...`, `toggles private mode...`) FAIL — no top-sites markup and no button named "Private mode" exist yet.

- [ ] **Step 3: Add the Top Sites panel and Private Mode toggle to App.tsx**

In `src/popup/App.tsx`, update the imports at the top of the file — add `updateSettings` and the two constants helper:

```tsx
import { useState, useEffect } from 'react'
import { ScoreRing } from './components/ScoreRing'
import { ScreenTimeBar } from './components/ScreenTimeBar'
import { CoachingCard } from './components/CoachingCard'
import { useSettings } from '../shared/hooks/useStorage'
import { useScores } from '../shared/hooks/useScores'
import { updateSettings } from '../shared/StorageManager'
import { categorizeDomain, CATEGORY_COLORS } from '../shared/constants'
import { getShortVideosByDateRange, getVisitsByDateRange } from '../shared/db'
import { getTodayRange } from '../shared/constants'
```

Add a `fmt` helper and a `TopSites` sub-component right after the existing `Pill` function (before `export function App()`):

```tsx
function fmt(totalSec: number): string {
  const m = Math.round(totalSec / 60)
  if (m < 1) return '<1m'
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

function TopSites({ sites }: { sites: Array<{ domain: string; duration: number }> }) {
  const top = sites.slice(0, 3)
  if (top.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11.5px] font-extrabold tracking-wide text-ink-500">TOP SITES TODAY</span>
      {top.map(site => {
        const color = CATEGORY_COLORS[categorizeDomain(site.domain) ?? 'other']
        return (
          <div
            key={site.domain}
            className="flex items-center gap-2.5 rounded-[13px] border-[1.5px] border-[rgba(54,43,26,.25)] bg-[#f3ecd9] px-[13px] py-[9px]"
          >
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-bold uppercase"
              style={{ background: `${color}22`, color }}
              aria-hidden="true"
            >
              {site.domain[0] ?? '?'}
            </span>
            <span className="flex-1 truncate text-[13px] font-medium text-ink-200">{site.domain}</span>
            <span className="flex-shrink-0 text-[12.5px] tabular-nums text-ink-400">{fmt(site.duration)}</span>
          </div>
        )
      })}
    </div>
  )
}
```

Add a `LockIcon` component right after `BRAND_MARK` (before `Pill`):

```tsx
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7"/>
      <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}
```

In the `App()` function body, add the private-mode click handler right after the existing `const today = ...` line:

```tsx
  const togglePrivateMode = () => {
    if (!settings) return
    updateSettings({ privateModeActive: !settings.privateModeActive })
  }
```

Replace the header's settings-gear `<button>` block — find:

```tsx
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-[rgba(54,43,26,.3)] bg-transparent text-ink-400 transition-colors hover:text-ink-200"
            aria-label="Settings"
          >
```

and insert this new button immediately BEFORE it (same parent `<div>`, so the two buttons sit side by side):

```tsx
          <button
            onClick={togglePrivateMode}
            aria-label={settings?.privateModeActive ? 'Private mode (on)' : 'Private mode'}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] transition-colors ${
              settings?.privateModeActive
                ? 'border-[#2f5238] bg-[#eef0e0] text-[#2f5238]'
                : 'border-[rgba(54,43,26,.3)] bg-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            <LockIcon />
          </button>
```

Note the header currently wraps the gear button alone in a flex container — check the surrounding JSX and make sure both buttons end up inside the same flex row (add `gap-2` to that wrapping container if it doesn't already have one, so the two circular buttons have spacing between them).

Finally, add the `TopSites` panel to the render, right after the existing "Shorts today" chip block and before the "coaching card" comment/block:

```tsx
        {/* top sites */}
        {summary && <TopSites sites={summary.topSites} />}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/popup/App.test.tsx`
Expected: all 5 tests pass.

- [ ] **Step 5: Verify the full suite, type-check, and build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all tests pass (no regressions in other files); build succeeds and prints `[check-worker-dom] OK`.

- [ ] **Step 6: Commit**

```bash
git add src/popup/App.tsx src/popup/App.test.tsx
git commit -m "feat: add top sites panel and private mode toggle to popup"
```

---

## Self-Review

- **Spec coverage:** Top Sites panel (top 3, category-tinted monogram via `categorizeDomain`/`CATEGORY_COLORS`, empty-state renders nothing) ✓; Private Mode header toggle (lock icon, active/inactive styling, `updateSettings` call, dynamic `aria-label`) ✓; no new data plumbing — both read existing fields ✓; no background/engine/message changes ✓.
- **Placeholder scan:** none — full code given for every new function/component/JSX block; exact commands with expected output.
- **Type consistency:** `TopSites` prop type `Array<{ domain: string; duration: number }>` matches `DailySummary.topSites`'s existing type exactly; `categorizeDomain`/`CATEGORY_COLORS` imported with the same names/signatures already used in `ScreenTimeDetails.tsx`; `updateSettings({ privateModeActive: boolean })` matches the existing `ExtensionSettings.privateModeActive: boolean` field and the same call shape used throughout `settings/App.tsx`.
