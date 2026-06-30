# Breathing Reset — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)
**Feature:** Fourth of the 5-part health-features series (break timer ✓ → bedtime wind-down ✓ → posture/hydration nudges ✓ → **breathing reset** → health trends). Covers only this feature.

## Goal

A manual, guided box-breathing reset: a calm full-screen page with an animated circle that leads the user through 4-4-4-4 breathing for ~1 minute. Fully local (no OpenRouter / API key), no background engine, no settings, no scoring.

## Decisions (from brainstorming)

- **Trigger:** manual only (no auto-offer, no background engine) — stays distinct from the time-based break timer.
- **Delivery:** a dedicated full-screen extension page (`breathe.html`), opened in a tab — not an on-page content-script overlay. Robust (works regardless of the active tab, no content-script dependency), single implementation, and a deliberate "step away" screen suits breathing.
- **Pattern:** box breathing 4-4-4-4 (inhale 4s → hold 4s → exhale 4s → hold 4s), **4 cycles** (~64s); stop early anytime.
- **Entry points:** a "Breathe" button in both the popup quick-links row and the dashboard quick-actions row.

## Existing context this builds on

- Extension pages are built as separate vite rollup inputs with an HTML entry + `main.tsx` (see `popup`, `settings`, `sidepanel` in `vite.config.ts`). This feature adds a `breathe` entry the same way.
- The dark WiseMind theme tokens live in `src/shared/index.css` (`bg-navy-950`, `text-ink-*`, `wm-panel`, `wm-brand-grad`). The new page reuses them.
- The popup (`src/popup/App.tsx`) has a quick-links row (`QuickLink`); the dashboard (`src/newtab/App.tsx`) has a quick-actions row with two buttons. Each gains a "Breathe" entry.
- No manifest change: the extension opens its own page via `chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })`. `web_accessible_resources` is not needed (that is only for web-page access, not extension-initiated navigation).

## Component 1: Breathing logic (`src/breathe/breathing.ts`) — the testable unit

A pure module with no DOM/Chrome dependencies:

```ts
export interface BreathPhase { label: string; seconds: number }

export const BOX_PATTERN: BreathPhase[] = [
  { label: 'Breathe in', seconds: 4 },
  { label: 'Hold', seconds: 4 },
  { label: 'Breathe out', seconds: 4 },
  { label: 'Hold', seconds: 4 },
]
export const TOTAL_CYCLES = 4

export interface BreathingState {
  cycle: number        // 1-based current cycle (1..TOTAL_CYCLES); TOTAL_CYCLES when done
  phaseIndex: number   // 0..3 within the pattern
  phaseLabel: string   // BOX_PATTERN[phaseIndex].label
  scale: number        // circle scale 0.5..1 for the current moment (grow on inhale, hold large, shrink on exhale, hold small)
  done: boolean        // true once elapsed >= cycle length * TOTAL_CYCLES
}

export function breathingState(elapsedSec: number): BreathingState
```

Math: cycle length = `BOX_PATTERN.reduce(seconds) = 16`s; total = `16 * TOTAL_CYCLES = 64`s. From `elapsedSec`:
- `done = elapsedSec >= 64` (clamp to the final resting state).
- `withinCycle = elapsedSec % 16`; `cycle = min(TOTAL_CYCLES, floor(elapsedSec / 16) + 1)`.
- Walk the phase durations to find `phaseIndex` and `secondsIntoPhase`.
- `scale`: 0.5→1 linearly during "Breathe in"; 1 during the hold after inhale; 1→0.5 during "Breathe out"; 0.5 during the hold after exhale. (The min/max bound the visual circle size.)

Deterministic and fully unit-testable.

## Component 2: The page (`src/breathe/App.tsx`)

A full-screen React component on the dark theme:
- A centered circle whose CSS `transform: scale(...)` follows `state.scale`, with a transition so motion is smooth between animation frames.
- The current `phaseLabel` and a "Cycle N of 4" counter.
- A small driver loop: `requestAnimationFrame` (or a ~200 ms interval) updates `elapsedSec = (Date.now() - start) / 1000`, recomputes `breathingState`, and re-renders. The loop stops when `state.done`.
- When `done`: show "Nicely done — carry the calm with you." and keep the **Done** button.
- **Done** button (and the **Esc** key) closes the tab: `chrome.tabs.getCurrent(tab => { if (tab?.id !== undefined) chrome.tabs.remove(tab.id) })`.

`src/breathe/main.tsx` mounts `<App />` into `breathe.html` (mirrors `popup/main.tsx`). `src/breathe.html` mirrors `popup.html` (imports the theme CSS + the entry module).

## Component 3: Triggers

- **Popup** (`src/popup/App.tsx`): add a `QuickLink` labeled **"Breathe"** to the existing quick-links row, `onClick` → `chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })`. (The row currently has Dashboard / AI Coach / Goals; "Breathe" joins it.)
- **Dashboard** (`src/newtab/App.tsx`): add a **"Breathe"** button to the quick-actions row (next to "Open AI Coach" / "Settings"), same `chrome.tabs.create` action, styled to match the existing secondary button.

## Build wiring (`vite.config.ts`)

Add `breathe: resolve(__dirname, 'src/breathe.html')` to `rollupOptions.input` (alongside `popup`, `settings`, `sidepanel`). The build emits `dist/breathe.html` + `dist/breathe.js`. React is already isolated into the `react-vendor` chunk by the existing `manualChunks` config, so the new page shares it like the other UI pages.

## Edge cases

- Opening multiple breathe tabs is harmless (each is independent).
- `chrome.tabs.getCurrent` returning undefined (rare) → the Done handler no-ops; the user can close the tab manually.
- The driver loop clamps at 64s and renders the resting/done state; no negative or overflow states.

## Testing

- `src/breathe/breathing.test.ts`: `breathingState` at `elapsed = 0` (cycle 1, "Breathe in", scale 0.5, not done); mid-inhale (scale between 0.5 and 1); at each phase boundary (4/8/12 s → correct label); start of cycle 2 (16 s); and at/after 64 s (`done === true`, `cycle === TOTAL_CYCLES`). Assert the scale endpoints per phase.
- `src/breathe/App.test.tsx`: a light render test — renders "Breathe in" initially and a "Cycle 1 of 4" counter; with fake timers advanced ~5 s, the label updates to "Hold". (Uses `vi.useFakeTimers()`; `chrome.tabs` mocked via `src/test/setup.ts`.)
- No engine/settings/scoring tests (none changed).

## Out of scope (future spec)

Weekly health-trends dashboard view (the 5th and final feature in the series).
