# Posture & Hydration Nudges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, AI-free nudge channel that shows a lightweight auto-dismissing toast alternating posture and hydration reminders while the user is at the screen.

**Architecture:** A background `WellnessNudgeEngine` (1-min `wellnessTick` alarm, mirrors `BreakTimerEngine`) returns a rotating posture/hydration message; `index.ts` suppresses it if a break/wind-down prompt fired in the last 2 minutes, else delivers via `NotificationManager.deliverNudge` → a self-dismissing toast in `mindfulOverlay.ts` (separate host id, no buttons). No scoring, no dashboard.

**Tech Stack:** TypeScript, React (settings), Chrome MV3 (`alarms`, `tabs`), Vitest.

## Global Constraints

- No OpenRouter / network dependency anywhere — works with an empty API key.
- Two new settings: `wellnessNudgesEnabled: boolean` (default **true**), `wellnessNudgeIntervalMinutes: number` (default **40**).
- Waking-hours guard: nudges only when local hour `>= 6 && < 23`.
- No-stacking: skip the nudge if a break/wind-down prompt was delivered within the last **2 minutes** (`lastOverlayShownAt`, tracked in `index.ts`).
- Toast: separate host id `wisemind-nudge-toast` (NOT `wisemind-overlay-host`), `pointer-events:none`, message via `textContent` (XSS-safe), auto-dismiss after **~6 s**, no buttons, no response message.
- `deliverNudge` delivers to the active tab only; on a restricted page it skips silently (NO system-notification fallback).
- Follow existing patterns: engines are plain classes instantiated at module level in `background/index.ts`; engine tests use Vitest + `vi.useFakeTimers()` + `vi.setSystemTime`; the `chrome` mock from `src/test/setup.ts` provides `chrome.alarms.create`.

---

### Task 1: Settings model + message type

**Files:**
- Modify: `src/shared/types.ts` (2 new `ExtensionSettings` fields; 1 new `ExtensionMessage` variant)
- Modify: `src/shared/StorageManager.ts:3-22` (2 defaults)
- Modify (as tsc requires): type-checked settings mocks — likely `src/newtab/components/Recommendations.test.tsx`, `src/newtab/components/WeeklyInsight.test.tsx`, `src/sidepanel/App.test.tsx` (trust tsc, not this list)
- Test: `src/shared/StorageManager.test.ts`

**Interfaces:**
- Produces: `ExtensionSettings.wellnessNudgesEnabled: boolean`, `wellnessNudgeIntervalMinutes: number`; message `{ type: 'SHOW_NUDGE'; payload: { message: string } }`.

- [ ] **Step 1: Write the failing test**

Add to `src/shared/StorageManager.test.ts`:

```ts
describe('DEFAULT_SETTINGS wellness nudges', () => {
  it('defaults nudges on at a 40-minute interval', () => {
    expect(DEFAULT_SETTINGS.wellnessNudgesEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.wellnessNudgeIntervalMinutes).toBe(40)
  })
})
```

(If `DEFAULT_SETTINGS` is not already imported in this file, add `import { DEFAULT_SETTINGS } from './StorageManager'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/StorageManager.test.ts`
Expected: FAIL — fields are `undefined` (and/or TS error).

- [ ] **Step 3: Add the type fields + message**

In `src/shared/types.ts`, inside `interface ExtensionSettings`, add after `windDownBedtime: number`:

```ts
  wellnessNudgesEnabled: boolean       // posture & hydration nudges
  wellnessNudgeIntervalMinutes: number // minutes between nudges
```

In the same file, extend the `ExtensionMessage` union:

```ts
  | { type: 'SHOW_NUDGE'; payload: { message: string } }
```

- [ ] **Step 4: Add the defaults**

In `src/shared/StorageManager.ts`, inside `DEFAULT_SETTINGS`, add after `windDownBedtime: 1380,`:

```ts
  wellnessNudgesEnabled: true,
  wellnessNudgeIntervalMinutes: 40,
```

- [ ] **Step 5: Fix type-checked mocks**

Run `npx tsc --noEmit`. For every error "property 'wellness…' is missing in type … ExtensionSettings", add these two lines to that mock's settings literal:

```ts
    wellnessNudgesEnabled: true,
    wellnessNudgeIntervalMinutes: 40,
```

Repeat until `npx tsc --noEmit` is clean. (Mocks using `as any` need no change.)

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/StorageManager.ts src/shared/StorageManager.test.ts
git commit -m "feat: add wellness nudge settings and SHOW_NUDGE message"
```

(Add any mock files you changed to the `git add` list.)

---

### Task 2: WellnessNudgeEngine

**Files:**
- Create: `src/background/WellnessNudgeEngine.ts`
- Test: `src/background/WellnessNudgeEngine.test.ts`

**Interfaces:**
- Consumes: `getSettings()` from `../shared/StorageManager` (reads `wellnessNudgesEnabled`, `privateModeActive`, `wellnessNudgeIntervalMinutes`).
- Produces: `export const NUDGES: string[]`; `export class WellnessNudgeEngine` with `init(): void`, `resetSession(): void`, `evaluate(): Promise<string | null>`.

- [ ] **Step 1: Write the failing tests**

Create `src/background/WellnessNudgeEngine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WellnessNudgeEngine, NUDGES } from './WellnessNudgeEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    wellnessNudgesEnabled: true,
    privateModeActive: false,
    wellnessNudgeIntervalMinutes: 40,
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    wellnessNudgesEnabled: true, privateModeActive: false, wellnessNudgeIntervalMinutes: 40, ...partial,
  } as any)
}

const NOON = new Date('2026-06-30T12:00:00')
const min = (n: number) => n * 60_000

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('WellnessNudgeEngine interval', () => {
  it('fires once the interval elapses', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('does not fire before the interval', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(39)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WellnessNudgeEngine gates', () => {
  it('null when disabled', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    await settingsOnce({ wellnessNudgesEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null in private mode', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(40)))
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null outside waking hours (3am)', async () => {
    vi.setSystemTime(new Date('2026-06-30T03:00:00'))
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-06-30T03:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WellnessNudgeEngine session + rotation', () => {
  it('resetSession restarts the interval', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(60)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(71)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('rotates through NUDGES and wraps', async () => {
    const engine = new WellnessNudgeEngine()
    engine.init()
    const seen: string[] = []
    for (let i = 1; i <= NUDGES.length + 1; i++) {
      vi.setSystemTime(new Date(NOON.getTime() + min(40 * i)))
      const m = await engine.evaluate()
      seen.push(m!)
    }
    expect(seen.slice(0, NUDGES.length)).toEqual(NUDGES)
    expect(seen[NUDGES.length]).toBe(NUDGES[0])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/background/WellnessNudgeEngine.test.ts`
Expected: FAIL — cannot import `WellnessNudgeEngine`.

- [ ] **Step 3: Write the engine**

Create `src/background/WellnessNudgeEngine.ts`:

```ts
import { getSettings } from '../shared/StorageManager'

const WAKE_START = 6
const WAKE_END = 23

// Ordered so rotation alternates posture and hydration.
export const NUDGES = [
  'Roll your shoulders back and sit up tall.',
  'Take a few sips of water.',
  'Unclench your jaw and relax your shoulders.',
  'Hydrate — have some water.',
  'Feet flat, back supported — reset your posture.',
  'Time for a water break — stay hydrated.',
]

/**
 * Deterministic, AI-free posture/hydration reminder. Fires a rotating nudge on a
 * fixed interval while the user is present (the streak resets on idle/locked).
 * State is in-memory; a service-worker restart costs at most one delayed nudge.
 */
export class WellnessNudgeEngine {
  private lastNudgeAt = Date.now()
  private index = 0

  init(): void {
    chrome.alarms.create('wellnessTick', { periodInMinutes: 1 })
    this.lastNudgeAt = Date.now()
  }

  resetSession(): void {
    this.lastNudgeAt = Date.now()
  }

  async evaluate(): Promise<string | null> {
    const settings = await getSettings()
    if (!settings.wellnessNudgesEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (now - this.lastNudgeAt < settings.wellnessNudgeIntervalMinutes * 60_000) return null

    const message = NUDGES[this.index % NUDGES.length]
    this.index++
    this.lastNudgeAt = now
    return message
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/background/WellnessNudgeEngine.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/WellnessNudgeEngine.ts src/background/WellnessNudgeEngine.test.ts
git commit -m "feat: add WellnessNudgeEngine with rotating posture/hydration nudges"
```

---

### Task 3: deliverNudge + lightweight toast

**Files:**
- Modify: `src/background/NotificationManager.ts`
- Modify: `src/content/mindfulOverlay.ts`

**Interfaces:**
- Consumes: message `SHOW_NUDGE` (Task 1).
- Produces: `NotificationManager.deliverNudge(message: string): Promise<void>`; overlay listener for `SHOW_NUDGE` that renders a self-dismissing toast.

- [ ] **Step 1: Add `deliverNudge` to NotificationManager**

In `src/background/NotificationManager.ts`, add a comma after the `deliverWindDown` method's closing brace, then add:

```ts
  async deliverNudge(message: string): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId === undefined) return
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_NUDGE', payload: { message } })
    } catch {
      // restricted page — skip silently; a missed posture nudge doesn't matter
    }
  }
```

- [ ] **Step 2: Add the toast to the overlay**

In `src/content/mindfulOverlay.ts`, append at the end of the file (after the last listener). It is fully self-contained (its own styles + host id):

```ts
const NUDGE_STYLES = `
  :host { all: initial; }
  .nudge {
    position: fixed; bottom: 24px; right: 24px;
    z-index: 2147483646; font-family: system-ui, sans-serif;
    background: rgba(15,23,42,0.95); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 12px 16px; color: #e2e8f0; font-size: 13.5px; line-height: 1.4; max-width: 280px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4); pointer-events: none;
    opacity: 0; transform: translateY(8px); transition: opacity .4s ease, transform .4s ease;
  }
  .nudge.show { opacity: 1; transform: translateY(0); }
`

function showNudgeToast(message: string): void {
  const existing = document.getElementById('wisemind-nudge-toast')
  existing?.remove()

  const host = document.createElement('div')
  host.id = 'wisemind-nudge-toast'
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = NUDGE_STYLES

  const toast = document.createElement('div')
  toast.className = 'nudge'
  toast.textContent = message

  shadow.appendChild(style)
  shadow.appendChild(toast)
  document.body.appendChild(host)

  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => host.remove(), 400)
  }, 6000)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_NUDGE') {
    showNudgeToast(msg.payload.message)
  }
})
```

- [ ] **Step 3: Verify build + content-script purity**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds. Confirm `dist/mindfulOverlay.js` still has no top-level `import` statements (content script).

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/background/NotificationManager.ts src/content/mindfulOverlay.ts
git commit -m "feat: lightweight posture/hydration toast + deliverNudge"
```

---

### Task 4: Wire WellnessNudgeEngine into the background

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `WellnessNudgeEngine` (Task 2), `NotificationManager.deliverNudge` (Task 3).

- [ ] **Step 1: Import and instantiate**

In `src/background/index.ts`, add to the engine imports (after the `WindDownEngine` import):

```ts
import { WellnessNudgeEngine } from './WellnessNudgeEngine'
```

Add the instance after `const windDown = new WindDownEngine()` (line 24):

```ts
const wellness = new WellnessNudgeEngine()
```

Add its init after `windDown.init()` (line 30):

```ts
wellness.init()
```

- [ ] **Step 2: Add the overlay-timestamp tracker**

In `src/background/index.ts`, add a module-level variable near the other module-level `let` declarations (e.g. just below the engine instances):

```ts
// When a break/wind-down prompt was last shown — used to suppress nudge stacking.
let lastOverlayShownAt = 0
```

- [ ] **Step 3: Stamp the tracker when a break/wind-down prompt fires**

In the `breakTimerTick` branch, add the stamp after delivery:

```ts
  if (alarm.name === 'breakTimerTick') {
    const prompt = await breakTimer.evaluate()
    if (prompt) {
      await NotificationManager.deliverBreak(prompt)
      lastOverlayShownAt = Date.now()
    }
  }
```

In the `windDownTick` branch, add the stamp after delivery:

```ts
  if (alarm.name === 'windDownTick') {
    const r = await windDown.evaluate()
    if (r) {
      await NotificationManager.deliverWindDown(r.message)
      lastOverlayShownAt = Date.now()
    }
  }
```

- [ ] **Step 4: Add the `wellnessTick` branch with suppression**

Add after the `windDownTick` branch:

```ts
  if (alarm.name === 'wellnessTick') {
    const message = await wellness.evaluate()
    if (message && Date.now() - lastOverlayShownAt >= 2 * 60_000) {
      await NotificationManager.deliverNudge(message)
    }
  }
```

- [ ] **Step 5: Reset the streak on idle/locked**

In the `chrome.idle.onStateChanged` handler, inside the existing `if (state === 'idle' || state === 'locked')` block (which already calls `coaching.resetSession()` and `breakTimer.resetSession()`), add:

```ts
    wellness.resetSession()
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run src/background/index.test.ts && npm run build`
Expected: no type errors; background tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: wire wellness nudge alarm with break/wind-down suppression"
```

---

### Task 5: Settings UI — Posture & Hydration section

**Files:**
- Modify: `src/settings/App.tsx`
- Test: `src/settings/App.test.tsx`

**Interfaces:**
- Consumes: `settings.wellnessNudgesEnabled`, `settings.wellnessNudgeIntervalMinutes`, `updateSettings`.

- [ ] **Step 1: Add the two fields to the test's useSettings mock**

In `src/settings/App.test.tsx`, the `useSettings` mock object (around lines 8-23) is NOT type-checked, so Task 1 did not touch it. Add these two lines to that mock object so the section renders real values:

```ts
    wellnessNudgesEnabled: true,
    wellnessNudgeIntervalMinutes: 40,
```

- [ ] **Step 2: Write the failing test**

Add to `src/settings/App.test.tsx`:

```ts
it('updates the nudge interval when a preset is clicked', async () => {
  render(<App />)
  const btn = await screen.findByRole('button', { name: '60 min' })
  fireEvent.click(btn)
  expect(mockUpdateSettings).toHaveBeenCalledWith(
    expect.objectContaining({ wellnessNudgeIntervalMinutes: 60 })
  )
})
```

Note: a "60 min" button already exists in the Break Reminders section. After adding the Posture & Hydration section there will be two "60 min" buttons, so `findByRole` would match multiples. To disambiguate, scope the query to the new section: replace the query with

```ts
  const section = screen.getByText('Posture & Hydration').closest('section') as HTMLElement
  const btn = within(section).getByRole('button', { name: '60 min' })
```

and add `within` to the import from `@testing-library/react` if not already present.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: FAIL — no "Posture & Hydration" section / button yet.

- [ ] **Step 4: Add the section**

In `src/settings/App.tsx`, add a new `<section>` after the "Bedtime Wind-Down" section's closing `</section>`:

```tsx
        {/* Posture & Hydration */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Posture &amp; Hydration</h2>
          <p className="text-xs text-slate-500">
            Gentle posture and hydration reminders while you work — small toasts that fade on their own, no clicks. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable nudges</span>
            <input
              type="checkbox"
              checked={settings.wellnessNudgesEnabled}
              onChange={e => updateSettings({ wellnessNudgesEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Remind me every</label>
            <div className="flex gap-2">
              {[30, 40, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ wellnessNudgeIntervalMinutes: mins })}
                  disabled={!settings.wellnessNudgesEnabled}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 ${
                    settings.wellnessNudgeIntervalMinutes === mins
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </section>
```

- [ ] **Step 5: Run the settings tests**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: PASS (new test + existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/settings/App.tsx src/settings/App.test.tsx
git commit -m "feat: settings UI for posture & hydration nudges"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + `WellnessNudgeEngine` + settings).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; confirm `dist/mindfulOverlay.js` has no top-level `import` statements.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Load `dist/` as an unpacked extension and verify:
- Settings → Posture & Hydration shows the toggle (on) and interval presets (40 highlighted).
- Temporarily set the interval low (or lower it in the engine) and confirm: after the interval, a small toast appears bottom-right on a normal page, alternates posture/hydration text, and fades away on its own without needing a click.
- Within 2 minutes of a break or wind-down prompt, no nudge toast appears (suppression).
- Turning the toggle off stops the toasts.
- Revert any temporary interval edit.

- [ ] **Step 5: Commit (only if a revert/doc tweak was needed)**

```bash
git add -A
git commit -m "chore: finalize posture & hydration nudges"
```

---

## Self-Review

- **Spec coverage:** 2 settings + UI (Task 1, 5) ✓; `WellnessNudgeEngine` interval/gates/rotation + 1-min alarm (Task 2, 4) ✓; lightweight toast + `deliverNudge` (Task 3) ✓; suppression via `lastOverlayShownAt` (Task 4) ✓; waking hours 06:00–23:00, no fallback, ~6 s toast, separate host id — all in Global Constraints and code ✓; reset on idle (Task 4) ✓; private mode + restricted-page handled (Task 2, 3) ✓; no scoring / no dashboard ✓; no API dependency ✓.
- **Placeholder scan:** none — every code step shows full code; commands include expected output.
- **Type consistency:** `SHOW_NUDGE` payload `{ message: string }` identical across Tasks 1, 3, 4; `WellnessNudgeEngine` methods `init`/`resetSession`/`evaluate` match between Task 2, its tests, and the Task 4 wiring; settings field names identical across Tasks 1, 4, 5; `NUDGES` exported in Task 2 and asserted in its rotation test.
- **Note (Task 5 query):** the `within(section, '60 min')` scoping avoids the duplicate-button ambiguity created by the existing Break Reminders "60 min" button.
