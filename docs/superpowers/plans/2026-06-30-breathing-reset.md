# Breathing Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual guided box-breathing reset — a dedicated full-screen page (`breathe.html`) with an animated circle leading 4-4-4-4 breathing for ~1 minute, opened from "Breathe" buttons in the popup and dashboard.

**Architecture:** A pure `breathing.ts` module computes the box-breathing state from elapsed seconds (the unit-tested core). A new React page (`src/breathe/*`, a new vite rollup input) animates it. Two buttons open the page via `chrome.tabs.create`. No background engine, no settings, no scoring, no content script, no manifest change.

**Tech Stack:** TypeScript, React, Vite, Vitest.

## Global Constraints

- No OpenRouter / network dependency — fully local.
- Box breathing pattern exactly: `Breathe in 4s → Hold 4s → Breathe out 4s → Hold 4s`, `TOTAL_CYCLES = 4` (cycle = 16s, total = 64s).
- Circle scale bounds: min **0.5**, max **1** (grow on inhale, hold large, shrink on exhale, hold small).
- The page is opened via `chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })`; closed via `chrome.tabs.getCurrent` → `chrome.tabs.remove`. No `web_accessible_resources` / manifest change.
- Follow existing entry-page patterns: an HTML file + `main.tsx` mounting `<App />`, importing `../shared/index.css`; registered as a `rollupOptions.input` in `vite.config.ts`.
- Reuse the dark theme tokens (`bg-navy-950`, `text-ink-*`, `wm-brand-grad`, `font-display`). React is already split into the `react-vendor` chunk by the existing `manualChunks` config.

---

### Task 1: Breathing logic (pure module)

**Files:**
- Create: `src/breathe/breathing.ts`
- Test: `src/breathe/breathing.test.ts`

**Interfaces:**
- Produces:
  - `export interface BreathPhase { label: string; seconds: number }`
  - `export const BOX_PATTERN: BreathPhase[]`
  - `export const TOTAL_CYCLES: number`
  - `export interface BreathingState { cycle: number; phaseIndex: number; phaseLabel: string; scale: number; done: boolean }`
  - `export function breathingState(elapsedSec: number): BreathingState`

- [ ] **Step 1: Write the failing tests**

Create `src/breathe/breathing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { breathingState, BOX_PATTERN, TOTAL_CYCLES } from './breathing'

describe('breathingState', () => {
  it('starts in cycle 1, breathing in, at min scale', () => {
    const s = breathingState(0)
    expect(s.cycle).toBe(1)
    expect(s.phaseIndex).toBe(0)
    expect(s.phaseLabel).toBe('Breathe in')
    expect(s.scale).toBeCloseTo(0.5)
    expect(s.done).toBe(false)
  })

  it('grows the scale mid-inhale', () => {
    const s = breathingState(2) // halfway through the 4s inhale
    expect(s.phaseLabel).toBe('Breathe in')
    expect(s.scale).toBeCloseTo(0.75)
  })

  it('holds large after inhale', () => {
    const s = breathingState(4)
    expect(s.phaseIndex).toBe(1)
    expect(s.phaseLabel).toBe('Hold')
    expect(s.scale).toBeCloseTo(1)
  })

  it('shrinks during exhale', () => {
    const s = breathingState(10) // 2s into the exhale phase (phase starts at 8s)
    expect(s.phaseIndex).toBe(2)
    expect(s.phaseLabel).toBe('Breathe out')
    expect(s.scale).toBeCloseTo(0.75)
  })

  it('holds small after exhale', () => {
    const s = breathingState(12)
    expect(s.phaseIndex).toBe(3)
    expect(s.phaseLabel).toBe('Hold')
    expect(s.scale).toBeCloseTo(0.5)
  })

  it('advances to cycle 2 at 16s', () => {
    const s = breathingState(16)
    expect(s.cycle).toBe(2)
    expect(s.phaseIndex).toBe(0)
    expect(s.phaseLabel).toBe('Breathe in')
  })

  it('is done at/after the total duration', () => {
    expect(breathingState(64).done).toBe(true)
    expect(breathingState(64).cycle).toBe(TOTAL_CYCLES)
    expect(breathingState(100).done).toBe(true)
  })

  it('has the expected pattern shape', () => {
    expect(BOX_PATTERN.map(p => p.label)).toEqual(['Breathe in', 'Hold', 'Breathe out', 'Hold'])
    expect(BOX_PATTERN.every(p => p.seconds === 4)).toBe(true)
    expect(TOTAL_CYCLES).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/breathe/breathing.test.ts`
Expected: FAIL — cannot import `breathingState`.

- [ ] **Step 3: Write the module**

Create `src/breathe/breathing.ts`:

```ts
export interface BreathPhase {
  label: string
  seconds: number
}

// Box breathing: inhale, hold, exhale, hold — each 4 seconds.
export const BOX_PATTERN: BreathPhase[] = [
  { label: 'Breathe in', seconds: 4 },
  { label: 'Hold', seconds: 4 },
  { label: 'Breathe out', seconds: 4 },
  { label: 'Hold', seconds: 4 },
]
export const TOTAL_CYCLES = 4

const CYCLE_SECONDS = BOX_PATTERN.reduce((sum, p) => sum + p.seconds, 0) // 16
const TOTAL_SECONDS = CYCLE_SECONDS * TOTAL_CYCLES // 64
const SCALE_MIN = 0.5
const SCALE_MAX = 1

export interface BreathingState {
  cycle: number       // 1-based, capped at TOTAL_CYCLES
  phaseIndex: number  // 0..3
  phaseLabel: string
  scale: number       // SCALE_MIN..SCALE_MAX
  done: boolean
}

/**
 * Pure mapping from elapsed seconds to the current box-breathing state. The
 * circle scale grows during inhale, holds large, shrinks during exhale, holds
 * small. Clamps to the resting "done" state once the session completes.
 */
export function breathingState(elapsedSec: number): BreathingState {
  if (elapsedSec >= TOTAL_SECONDS) {
    return { cycle: TOTAL_CYCLES, phaseIndex: 3, phaseLabel: BOX_PATTERN[3].label, scale: SCALE_MIN, done: true }
  }

  const clamped = Math.max(0, elapsedSec)
  const cycle = Math.floor(clamped / CYCLE_SECONDS) + 1

  let within = clamped % CYCLE_SECONDS
  let phaseIndex = 0
  for (let i = 0; i < BOX_PATTERN.length; i++) {
    if (within < BOX_PATTERN[i].seconds) {
      phaseIndex = i
      break
    }
    within -= BOX_PATTERN[i].seconds
  }

  const progress = within / BOX_PATTERN[phaseIndex].seconds // 0..1 into the phase
  let scale: number
  switch (phaseIndex) {
    case 0: scale = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * progress; break // inhale: grow
    case 1: scale = SCALE_MAX; break                                      // hold: large
    case 2: scale = SCALE_MAX - (SCALE_MAX - SCALE_MIN) * progress; break // exhale: shrink
    default: scale = SCALE_MIN; break                                     // hold: small
  }

  return { cycle, phaseIndex, phaseLabel: BOX_PATTERN[phaseIndex].label, scale, done: false }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/breathe/breathing.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/breathe/breathing.ts src/breathe/breathing.test.ts
git commit -m "feat: add pure box-breathing state module"
```

---

### Task 2: Breathing page (UI + entry + build wiring)

**Files:**
- Create: `src/breathe/App.tsx`
- Create: `src/breathe/main.tsx`
- Create: `src/breathe.html`
- Modify: `vite.config.ts` (add the `breathe` rollup input)
- Test: `src/breathe/App.test.tsx`

**Interfaces:**
- Consumes: `breathingState`, `TOTAL_CYCLES` from `./breathing` (Task 1).
- Produces: the `breathe.html` page bundle (`dist/breathe.html` + `dist/breathe.js`).

- [ ] **Step 1: Write the failing test**

Create `src/breathe/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Breathe App', () => {
  it('renders the first phase, the cycle counter, and a Done button', () => {
    render(<App />)
    expect(screen.getByText('Breathe in')).toBeInTheDocument()
    expect(screen.getByText('Cycle 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/breathe/App.test.tsx`
Expected: FAIL — cannot import `App` from `./App`.

- [ ] **Step 3: Create the page component**

Create `src/breathe/App.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import { breathingState, TOTAL_CYCLES } from './breathing'

function closeTab(): void {
  chrome.tabs.getCurrent(tab => {
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id)
  })
}

export function App() {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000)
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeTab()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const state = breathingState(elapsed)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-navy-950 font-sans text-ink-100">
      <div className="text-center">
        <div className="mb-2 font-display text-3xl font-medium tracking-tight">
          {state.done ? 'Nicely done' : state.phaseLabel}
        </div>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-600">
          {state.done ? 'carry the calm with you' : `Cycle ${state.cycle} of ${TOTAL_CYCLES}`}
        </div>
      </div>

      <div
        className="rounded-full wm-brand-grad"
        style={{
          width: 220,
          height: 220,
          transform: `scale(${state.scale})`,
          transition: 'transform 0.2s linear',
          boxShadow: '0 0 90px -10px rgba(52,211,153,0.55)',
        }}
        aria-hidden="true"
      />

      <button
        onClick={closeTab}
        className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-7 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10"
      >
        Done
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/breathe/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the entry files**

Create `src/breathe/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../shared/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

Create `src/breathe.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Breathe · WiseMind AI</title></head>
<body><div id="root"></div><script type="module" src="./breathe/main.tsx"></script></body>
</html>
```

- [ ] **Step 6: Register the rollup input**

In `vite.config.ts`, add to the `input` object (after the `settings` line):

```ts
        breathe: resolve(__dirname, 'src/breathe.html'),
```

- [ ] **Step 7: Build and verify the page is emitted**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds and emits `dist/breathe.html` and `dist/breathe.js`.

- [ ] **Step 8: Commit**

```bash
git add src/breathe/App.tsx src/breathe/main.tsx src/breathe.html src/breathe/App.test.tsx vite.config.ts
git commit -m "feat: breathing reset page with animated box-breathing circle"
```

---

### Task 3: Triggers (popup + dashboard buttons)

**Files:**
- Modify: `src/popup/App.tsx` (add a "Breathe" QuickLink)
- Modify: `src/newtab/App.tsx` (add a "Breathe" button to the quick-actions row)

**Interfaces:**
- Consumes: the `breathe.html` page (Task 2), opened via `chrome.tabs.create`.

- [ ] **Step 1: Add the popup Breathe quick-link**

In `src/popup/App.tsx`, the quick-links row currently renders three `QuickLink`s (Dashboard, AI Coach, Goals). Add a "Breathe" link. Replace the existing block:

```tsx
        {/* quick links */}
        <div className="mt-1 flex gap-2">
          <QuickLink label="Dashboard" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
          <QuickLink
            label="AI Coach"
            onClick={() => chrome.windows.getCurrent(w => { if (w.id !== undefined) void chrome.sidePanel.open({ windowId: w.id }) })}
          />
          <QuickLink label="Goals" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
        </div>
```

with:

```tsx
        {/* quick links */}
        <div className="mt-1 flex gap-2">
          <QuickLink label="Dashboard" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
          <QuickLink label="Breathe" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })} />
          <QuickLink
            label="AI Coach"
            onClick={() => chrome.windows.getCurrent(w => { if (w.id !== undefined) void chrome.sidePanel.open({ windowId: w.id }) })}
          />
          <QuickLink label="Goals" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') })} />
        </div>
```

- [ ] **Step 2: Add the dashboard Breathe button**

In `src/newtab/App.tsx`, the quick-actions row near the end renders an "Open AI Coach" button and a "Settings" button. Add a "Breathe" button between them. Locate:

```tsx
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })}
            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10"
          >
            Settings
          </button>
```

and insert immediately BEFORE that `Settings` button:

```tsx
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('breathe.html') })}
            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10"
          >
            Breathe
          </button>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run src/popup/App.test.tsx src/newtab/App.test.tsx && npm run build`
Expected: no type errors; the popup and dashboard tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/popup/App.tsx src/newtab/App.tsx
git commit -m "feat: add Breathe buttons to popup and dashboard"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + `breathing` + breathe `App`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `dist/breathe.html` and `dist/breathe.js` are emitted.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Reload `dist/` as an unpacked extension and verify:
- Popup → "Breathe" opens a calm full-screen tab; the circle expands on "Breathe in", holds, shrinks on "Breathe out", and the phase label + "Cycle N of 4" update; after 4 cycles it shows "Nicely done".
- Dashboard (new tab) → "Breathe" opens the same page.
- The **Done** button and the **Esc** key close the breathing tab.

- [ ] **Step 5: Commit (only if a tweak was needed)**

```bash
git add -A
git commit -m "chore: finalize breathing reset"
```

---

## Self-Review

- **Spec coverage:** dedicated `breathe.html` page + vite input (Task 2) ✓; pure `breathing.ts` with `breathingState` + box pattern + 4 cycles + scale bounds (Task 1) ✓; page UI with animated circle, phase label, cycle counter, Done/Esc close (Task 2) ✓; popup + dashboard triggers (Task 3) ✓; no engine/settings/scoring/manifest change ✓; no API dependency ✓.
- **Placeholder scan:** none — every code step shows full code; commands include expected output.
- **Type consistency:** `breathingState(elapsedSec) → BreathingState { cycle, phaseIndex, phaseLabel, scale, done }` identical between Task 1 definition, its tests, and Task 2's `App.tsx`; `TOTAL_CYCLES`/`BOX_PATTERN` exported in Task 1 and used in Task 2; `breathe.html` path string identical across Task 2 (html/vite) and Task 3 (`chrome.runtime.getURL('breathe.html')`).
- **Note (App test determinism):** the breathe `App.test.tsx` asserts the initial render only (elapsed 0 → "Breathe in", "Cycle 1 of 4") under fake timers so the 200 ms driver interval never fires; the phase/scale progression is fully covered by the pure `breathing.test.ts`.
