# Popup — More Details & Private Mode Toggle

**Date:** 2026-07-03
**Status:** Approved (pending spec review)
**Feature:** Add a "Top Sites Today" panel and a quick Private Mode toggle to the extension popup.

## Goal

The popup currently shows only the Health ring, Productivity/Learning pills, an optional screen-time bar, and a Shorts counter — with no per-site detail and no in-context way to enable Private Mode (only reachable via the full Settings page). Add both, using data and settings that already exist elsewhere in the app.

## Decisions (from brainstorming)

- **Details:** "Top Sites Today" — a compact list of the top domains visited today (not category breakdown, which the popup's existing `ScreenTimeBar` already covers when there's data).
- **Options:** a quick **Private Mode** toggle, placed as a lock-icon button in the header row next to the Settings gear (not a full row/pill — keeps the header compact and the toggle always visible).
- Both reuse existing data/settings — no new tracking, no background/engine changes, no new message types.

## Component 1: Top Sites Today

**Data source:** `settings.todaysSummary.topSites` — `Array<{ domain: string; duration: number }>`, already computed and sorted descending by `ScoringEngine.computeAndStore()` (top 10 domains). No new plumbing.

**Placement:** in `src/popup/App.tsx`, between the existing "Shorts today" chip and the quick-links row.

**Rendering:**
- Show the top **3** entries from `topSites` (`.slice(0, 3)`).
- Each row: a small (28px) category-tinted domain monogram (first letter, uppercase) — category resolved client-side via `categorizeDomain(domain)` from `src/shared/constants.ts` (already exported; returns `Category | null`), tinted with `CATEGORY_COLORS[category]` at low opacity (matching the dashboard's `DomainActivity` monogram style: `background: ${color}22`, `color`), falling back to a neutral ink tint when `categorizeDomain` returns `null`. Domain name (truncated) + formatted duration (`Xh Ym` / `Xm`, reusing the same `fmt` pattern already used in `ScreenTimeBar`/`DomainActivity`).
- Card container matches the existing Fable inner-panel style used elsewhere in the popup (`bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-[13px]`, consistent with the `Pill` component already in this file).
- **Empty state:** when `topSites` is empty or `summary` is undefined, render nothing (matches the existing `{summary && summary.totalTime > 0 && <ScreenTimeBar .../>}` conditional-render convention already used in this file — no empty-state message needed in the compact popup; the section simply doesn't appear).

## Component 2: Private Mode quick toggle

**Data:** `settings.privateModeActive: boolean` (existing field) via `updateSettings` from `../shared/StorageManager` (not currently imported in `popup/App.tsx` — add the import).

**Placement:** in the header row, immediately to the left of the existing Settings gear button.

**Rendering:**
- A button matching the gear button's size/shape (`h-[34px] w-[34px] rounded-full border-[1.5px]`), containing a lock SVG icon (closed padlock).
- **Inactive** (privateModeActive === false): same treatment as the gear button — `border-[rgba(54,43,26,.3)] bg-transparent text-ink-400`.
- **Active** (privateModeActive === true): filled/tinted — `border-[#2f5238] bg-[#eef0e0] text-[#2f5238]` (the same green-tint pattern used for the Break/Eye-Strain "enabled" segmented-button state elsewhere in the app), so the on-state is visually obvious at a glance without reading text.
- `onClick`: `updateSettings({ privateModeActive: !settings.privateModeActive })`. Optimistic UI is unnecessary — `useSettings()` already re-renders reactively on storage change (same hook already driving the rest of this component).
- `aria-label`: `"Private mode"` when off, `"Private mode (on)"` when on — mirrors the pattern of dynamic labels elsewhere in the codebase (e.g. the side panel's send button).

## Edge cases

- `settings` can be `undefined` on first paint (before storage loads) — the toggle button must guard against this: disable/no-op the click handler (or simply not render the button) until `settings` is loaded, matching how the rest of the popup already guards on `settings?.foo`.
- `topSites` domains may be long — truncate with `overflow-hidden text-ellipsis whitespace-nowrap` (same truncation pattern as `DomainActivity.tsx`'s `truncate` class).

## Testing

- `src/popup/App.test.tsx` (existing file — check current coverage first): add a test asserting the Top Sites section renders the top domain's name and formatted duration when `todaysSummary.topSites` has entries, and a test asserting clicking the Private Mode toggle calls `updateSettings({ privateModeActive: true })` when starting from `false`.
- No new test files; no background/engine tests needed (no logic changes outside the popup component).

## Out of scope

Category breakdown (already covered by the existing `ScreenTimeBar`), the "start eye/break now" quick action, and additional Settings-section quick links — all explicitly deferred per the brainstorming answers.
