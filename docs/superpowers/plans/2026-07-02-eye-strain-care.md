# Eye Strain Care Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, guided, skippable 4-step overlay addressing the real causes of digital eye strain (blink rate, focal distance, brightness/glare, posture/distance), firing every 30 minutes by default, independent of the existing Break Timer.

**Architecture:** A new background `EyeStrainCareEngine` (1-min alarm, structurally mirrors `BreakTimerEngine`) returns the fixed 4-step sequence when due. `NotificationManager.deliverEyeStrainCare` sends it to the active tab; a new overlay builder in `mindfulOverlay.ts` renders a step-through card that auto-advances between steps and reports `completed`/`skipped` back to the background, where `completed` credits `todaysSummary.breaks`.

**Tech Stack:** TypeScript, React (settings UI), Chrome MV3 (`alarms`, `tabs`), Vitest.

## Global Constraints

- No OpenRouter / network dependency — fully local and deterministic, mirrors `BreakTimerEngine`'s structure exactly (same gate order: enabled → private mode → waking hours → interval; mutate state only on the return-value path).
- New settings: `eyeStrainCareEnabled: boolean` (default **true**), `eyeStrainCareIntervalMinutes: number` (default **30**).
- Waking-hours guard: local hour `>= 6 && < 23` (same constants as `BreakTimerEngine`).
- The 4 steps are **fixed and always shown in full, in order** — not rotating, not partial:
  1. `blink` — "Blink" / "Blink slowly and fully, ten times." / 10s
  2. `look_away` — "Look away" / "Look at something at least 20 feet away." / 20s
  3. `posture` — "Check your posture" / "Sit up straight, screen at eye level, about an arm's length away." / 15s
  4. `brightness` — "Check your brightness" / "Match your screen brightness to the room around you." / 10s
- `mindfulOverlay.ts` is a content script and MUST stay dependency-free (no ES imports) — the new overlay builder reuses 100% existing CSS classes (`.stats`, `.message`, `.break-instruction`, `.countdown`, `.break-done`, `.actions`, `.btn`, `.btn-primary`, `.btn-secondary`, `.close`); no new CSS is added.
- Completing the walkthrough increments `todaysSummary.breaks` by 1 (same field/pattern as `BREAK_RESPONSE`'s `completed` branch); skipping does not.
- This feature does NOT modify `BreakTimerEngine.ts`, `BREAK_PROMPTS`, or any of its existing tests.
- After every task: `npx tsc --noEmit`, `npx vitest run` (all existing tests must still pass), `npm run build` (must print `[check-worker-dom] OK`).

---

### Task 1: Settings model + message types

**Files:**
- Modify: `src/shared/types.ts` (2 new `ExtensionSettings` fields; 2 new `ExtensionMessage` variants)
- Modify: `src/shared/StorageManager.ts` (2 new defaults in `DEFAULT_SETTINGS`)
- Test: `src/shared/StorageManager.test.ts`

**Interfaces:**
- Produces: `ExtensionSettings.eyeStrainCareEnabled: boolean`, `ExtensionSettings.eyeStrainCareIntervalMinutes: number`; messages `{ type: 'SHOW_EYE_STRAIN_CARE'; payload: { steps: { id: string; title: string; instruction: string; durationSec: number }[] } }` and `{ type: 'EYE_STRAIN_RESPONSE'; payload: { response: 'completed' | 'skipped' } }`.

- [ ] **Step 1: Write the failing test**

Add to `src/shared/StorageManager.test.ts` (find the existing `describe('DEFAULT_SETTINGS ...')` blocks and add a new one alongside them; `DEFAULT_SETTINGS` is already imported in this file):

```ts
describe('DEFAULT_SETTINGS eye strain care', () => {
  it('defaults enabled at a 30-minute interval', () => {
    expect(DEFAULT_SETTINGS.eyeStrainCareEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.eyeStrainCareIntervalMinutes).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/StorageManager.test.ts`
Expected: FAIL — the fields are `undefined` (and/or a TS error).

- [ ] **Step 3: Add the type fields + messages**

In `src/shared/types.ts`, inside `interface ExtensionSettings`, add two lines after the existing `wellnessNudgeIntervalMinutes: number` field:

```ts
  eyeStrainCareEnabled: boolean        // guided 4-step eye-strain-care overlay
  eyeStrainCareIntervalMinutes: number // minutes between eye-strain-care prompts
```

In the same file, extend the `ExtensionMessage` union with two new members (add after the existing `SHOW_NUDGE` variant):

```ts
  | { type: 'SHOW_EYE_STRAIN_CARE'; payload: { steps: { id: string; title: string; instruction: string; durationSec: number }[] } }
  | { type: 'EYE_STRAIN_RESPONSE'; payload: { response: 'completed' | 'skipped' } }
```

- [ ] **Step 4: Add the defaults**

In `src/shared/StorageManager.ts`, inside `DEFAULT_SETTINGS`, add two lines after the existing `wellnessNudgeIntervalMinutes: 40,` entry:

```ts
  eyeStrainCareEnabled: true,
  eyeStrainCareIntervalMinutes: 30,
```

- [ ] **Step 5: Fix any type-checked mocks tsc flags**

Run `npx tsc --noEmit`. For every error of the form "property 'eyeStrainCare...' is missing in type … ExtensionSettings", add these two lines to that mock's settings object literal (match the indentation already used in that file):

```ts
    eyeStrainCareEnabled: true,
    eyeStrainCareIntervalMinutes: 30,
```

Repeat until `npx tsc --noEmit` exits clean. (Mocks using `as any` need no change; based on the current codebase, the likely files are `src/newtab/components/Recommendations.test.tsx`, `src/newtab/components/WeeklyInsight.test.tsx`, and `src/sidepanel/App.test.tsx` — but trust `tsc`'s actual output, not this list.)

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run`
Expected: all tests pass (including the new one).

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/StorageManager.ts src/shared/StorageManager.test.ts
git commit -m "feat: add eye-strain-care settings and message types"
```

(Add any additional mock files you changed in Step 5 to this `git add`.)

---

### Task 2: EyeStrainCareEngine

**Files:**
- Create: `src/background/EyeStrainCareEngine.ts`
- Test: `src/background/EyeStrainCareEngine.test.ts`

**Interfaces:**
- Consumes: `getSettings()` from `../shared/StorageManager` (reads `eyeStrainCareEnabled`, `privateModeActive`, `eyeStrainCareIntervalMinutes`).
- Produces:
  - `export interface EyeStrainStep { id: string; title: string; instruction: string; durationSec: number }`
  - `export const EYE_STRAIN_STEPS: EyeStrainStep[]`
  - `export class EyeStrainCareEngine` with `init(): void`, `resetSession(): void`, `evaluate(): Promise<EyeStrainStep[] | null>`, `complete(): void`, `skip(): void`.

- [ ] **Step 1: Write the failing tests**

Create `src/background/EyeStrainCareEngine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EyeStrainCareEngine, EYE_STRAIN_STEPS } from './EyeStrainCareEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    eyeStrainCareEnabled: true,
    privateModeActive: false,
    eyeStrainCareIntervalMinutes: 30,
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    eyeStrainCareEnabled: true, privateModeActive: false, eyeStrainCareIntervalMinutes: 30, ...partial,
  } as any)
}

const NOON = new Date('2026-07-02T12:00:00')
const min = (n: number) => n * 60_000

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('EyeStrainCareEngine interval', () => {
  it('fires once the interval elapses', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    const steps = await engine.evaluate()
    expect(steps).not.toBeNull()
    expect(steps).toEqual(EYE_STRAIN_STEPS)
  })

  it('does not fire before the interval', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(29)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('EyeStrainCareEngine gates', () => {
  it('returns null when disabled', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    await settingsOnce({ eyeStrainCareEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null in private mode', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null outside waking hours (before 6am)', async () => {
    vi.setSystemTime(new Date('2026-07-02T02:00:00'))
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-07-02T02:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('EyeStrainCareEngine responses + rotation', () => {
  it('complete() restarts the interval', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.complete()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('skip() restarts the interval with no immediate re-fire', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.skip()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('resetSession() restarts the interval (idle/locked)', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(20)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(51)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('always returns all 4 steps in the fixed order, every time it fires', async () => {
    const engine = new EyeStrainCareEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    const first = await engine.evaluate()
    expect(first?.map(s => s.id)).toEqual(['blink', 'look_away', 'posture', 'brightness'])
    engine.complete()
    vi.setSystemTime(new Date(NOON.getTime() + min(61)))
    const second = await engine.evaluate()
    expect(second?.map(s => s.id)).toEqual(['blink', 'look_away', 'posture', 'brightness'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/background/EyeStrainCareEngine.test.ts`
Expected: FAIL — cannot import `EyeStrainCareEngine`.

- [ ] **Step 3: Write the engine**

Create `src/background/EyeStrainCareEngine.ts`:

```ts
import { getSettings } from '../shared/StorageManager'

export interface EyeStrainStep {
  id: string
  title: string
  instruction: string
  durationSec: number
}

// Fixed sequence covering the four real causes of digital eye strain. Always
// shown in full, in this order — not rotating, not partial.
export const EYE_STRAIN_STEPS: EyeStrainStep[] = [
  { id: 'blink', title: 'Blink', instruction: 'Blink slowly and fully, ten times.', durationSec: 10 },
  { id: 'look_away', title: 'Look away', instruction: 'Look at something at least 20 feet away.', durationSec: 20 },
  { id: 'posture', title: 'Check your posture', instruction: "Sit up straight, screen at eye level, about an arm's length away.", durationSec: 15 },
  { id: 'brightness', title: 'Check your brightness', instruction: 'Match your screen brightness to the room around you.', durationSec: 10 },
]

const WAKE_START = 6  // inclusive hour
const WAKE_END = 23   // exclusive hour

/**
 * Deterministic, AI-free eye-strain-care timer. Independent of BreakTimerEngine
 * — both may fire; they address different things. State is in-memory; a
 * service-worker restart resets the streak (at worst one delayed prompt).
 */
export class EyeStrainCareEngine {
  private lastFiredAt = Date.now()

  init(): void {
    chrome.alarms.create('eyeStrainTick', { periodInMinutes: 1 })
    this.lastFiredAt = Date.now()
  }

  /** Called when the user goes idle/locked — the streak resets. */
  resetSession(): void {
    this.lastFiredAt = Date.now()
  }

  /** Decide whether to show the walkthrough now. Mutates state only when it returns steps. */
  async evaluate(): Promise<EyeStrainStep[] | null> {
    const settings = await getSettings()
    if (!settings.eyeStrainCareEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (now < this.lastFiredAt + settings.eyeStrainCareIntervalMinutes * 60_000) return null

    this.lastFiredAt = now
    return EYE_STRAIN_STEPS
  }

  /** User finished the full walkthrough — restart the interval. */
  complete(): void {
    this.lastFiredAt = Date.now()
  }

  /** User skipped — no break credit; wait a full interval before re-prompting. */
  skip(): void {
    this.lastFiredAt = Date.now()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/background/EyeStrainCareEngine.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/EyeStrainCareEngine.ts src/background/EyeStrainCareEngine.test.ts
git commit -m "feat: add EyeStrainCareEngine with fixed 4-step sequence"
```

---

### Task 3: deliverEyeStrainCare + sequential overlay card

**Files:**
- Modify: `src/background/NotificationManager.ts`
- Modify: `src/content/mindfulOverlay.ts`

**Interfaces:**
- Consumes: `EyeStrainStep`-shaped objects `{ id, title, instruction, durationSec }`; message types `SHOW_EYE_STRAIN_CARE` / `EYE_STRAIN_RESPONSE` from Task 1.
- Produces: `NotificationManager.deliverEyeStrainCare(steps: { id: string; title: string; instruction: string; durationSec: number }[]): Promise<void>`; an overlay listener for `SHOW_EYE_STRAIN_CARE` that renders a step-through card and emits `EYE_STRAIN_RESPONSE`.

- [ ] **Step 1: Add `deliverEyeStrainCare` to NotificationManager**

In `src/background/NotificationManager.ts`, add a comma after the `deliverNudge` method's closing brace (or whichever method is currently last in the object), then add:

```ts
  async deliverEyeStrainCare(steps: { id: string; title: string; instruction: string; durationSec: number }[]): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_EYE_STRAIN_CARE', payload: { steps } })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Eye strain care',
      message: 'Time for a quick eye-care break — blink, look away, check posture and brightness.',
    })
  },
```

- [ ] **Step 2: Add the sequential overlay card to mindfulOverlay.ts**

In `src/content/mindfulOverlay.ts`, append at the end of the file (after the existing `SHOW_NUDGE` listener). This reuses only EXISTING CSS classes already defined in `OVERLAY_STYLES` (`.title`, `.message`, `.stats`, `.break-instruction`, `.countdown`, `.break-done`, `.actions`, `.btn`, `.btn-primary`, `.btn-secondary`, `.close`) — do NOT add any new CSS:

```ts
interface EyeStrainStepPayload {
  id: string
  title: string
  instruction: string
  durationSec: number
}

function createEyeStrainOverlay(steps: EyeStrainStepPayload[]): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Eye Strain Care</div>
    <div class="stats"></div>
    <div class="message"></div>
    <div class="break-instruction"></div>
    <div class="countdown"></div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="skip">Skip</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const stepEl = card.querySelector('.stats')
  const msgEl = card.querySelector('.message')
  const instrEl = card.querySelector('.break-instruction')
  const countEl = card.querySelector('.countdown')

  let timer: ReturnType<typeof setInterval> | null = null
  let stepIndex = 0

  const report = (response: 'completed' | 'skipped') => {
    if (timer) clearInterval(timer)
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'EYE_STRAIN_RESPONSE', payload: { response } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  const showDone = () => {
    if (stepEl) stepEl.remove()
    if (msgEl) msgEl.textContent = ''
    if (instrEl) instrEl.remove()
    if (countEl) countEl.remove()
    const actions = card.querySelector('.actions')
    if (actions) actions.remove()
    const done = document.createElement('div')
    done.className = 'break-done'
    done.textContent = '✓ Nicely done — your eyes thank you.'
    card.appendChild(done)
    const ok = document.createElement('button')
    ok.className = 'btn btn-primary'
    ok.textContent = 'Done'
    ok.addEventListener('click', () => report('completed'))
    card.appendChild(ok)
  }

  const runStep = () => {
    const step = steps[stepIndex]
    if (stepEl) stepEl.textContent = `Step ${stepIndex + 1} of ${steps.length}`
    if (msgEl) msgEl.textContent = step.title
    if (instrEl) instrEl.textContent = step.instruction
    let remaining = step.durationSec
    if (countEl) countEl.textContent = String(remaining)
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        if (countEl) countEl.textContent = String(remaining)
        return
      }
      if (timer) clearInterval(timer)
      stepIndex++
      if (stepIndex < steps.length) {
        runStep()
      } else {
        showDone()
      }
    }, 1000)
  }

  card.querySelector('.close')?.addEventListener('click', () => report('skipped'))
  card.querySelector('[data-action="skip"]')?.addEventListener('click', () => report('skipped'))

  runStep()

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_EYE_STRAIN_CARE') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createEyeStrainOverlay(msg.payload.steps)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})
```

- [ ] **Step 3: Verify build + content-script purity**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds; `[check-worker-dom] OK`. Confirm `dist/mindfulOverlay.js` still has no top-level `import` statements (it is a content script).

- [ ] **Step 4: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/background/NotificationManager.ts src/content/mindfulOverlay.ts
git commit -m "feat: sequential eye-strain-care overlay + deliverEyeStrainCare"
```

---

### Task 4: Wire EyeStrainCareEngine into the background

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `EyeStrainCareEngine` (Task 2), `NotificationManager.deliverEyeStrainCare` (Task 3).

- [ ] **Step 1: Import and instantiate**

In `src/background/index.ts`, add to the engine imports (after the existing `WellnessNudgeEngine` import):

```ts
import { EyeStrainCareEngine } from './EyeStrainCareEngine'
```

Add the instance after `const wellness = new WellnessNudgeEngine()`:

```ts
const eyeStrainCare = new EyeStrainCareEngine()
```

Add its init after `wellness.init()`:

```ts
eyeStrainCare.init()
```

- [ ] **Step 2: Handle the `eyeStrainTick` alarm**

In the `chrome.alarms.onAlarm` listener, add a new branch (e.g. right after the existing `wellnessTick` branch):

```ts
  if (alarm.name === 'eyeStrainTick') {
    const steps = await eyeStrainCare.evaluate()
    if (steps) {
      await NotificationManager.deliverEyeStrainCare(steps)
    }
  }
```

- [ ] **Step 3: Handle `EYE_STRAIN_RESPONSE` messages**

In the `chrome.runtime.onMessage.addListener` body, add a new branch (e.g. right after the existing `WIND_DOWN_RESPONSE` branch):

```ts
    if (message.type === 'EYE_STRAIN_RESPONSE') {
      const payload = message.payload as { response: 'completed' | 'skipped' }
      void (async () => {
        if (payload.response === 'completed') {
          eyeStrainCare.complete()
          const settings = await getSettings()
          if (settings.todaysSummary) {
            await updateSettings({
              todaysSummary: { ...settings.todaysSummary, breaks: settings.todaysSummary.breaks + 1 },
            })
          }
          scheduleRecompute()
        } else {
          eyeStrainCare.skip()
        }
      })()
      return false
    }
```

- [ ] **Step 4: Reset the streak on idle/locked**

In the `chrome.idle.onStateChanged` listener, inside the existing `if (state === 'idle' || state === 'locked')` block (which already calls `coaching.resetSession()`, `breakTimer.resetSession()`, and `wellness.resetSession()`), add:

```ts
    eyeStrainCare.resetSession()
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run src/background/index.test.ts && npm run build`
Expected: no type errors; background tests pass; build succeeds; `[check-worker-dom] OK`.

- [ ] **Step 6: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: wire eye-strain-care alarm, idle reset, and response handler"
```

---

### Task 5: Settings UI — Eye Strain Care section

**Files:**
- Modify: `src/settings/App.tsx`
- Test: `src/settings/App.test.tsx`

**Interfaces:**
- Consumes: `settings.eyeStrainCareEnabled` (enable flag), `settings.eyeStrainCareIntervalMinutes`, `updateSettings`.

- [ ] **Step 1: Write the failing test**

Add to `src/settings/App.test.tsx` (this file already imports `within` from `@testing-library/react` and already has type-checked-mock-independent settings via `mockUpdateSettings`; if the `useSettings` mock in this file is type-checked, add `eyeStrainCareEnabled: true, eyeStrainCareIntervalMinutes: 30,` to its settings object literal):

```ts
it('updates the eye-strain-care interval when a preset is clicked', async () => {
  render(<App />)
  const section = screen.getByText('Eye Strain Care').closest('section') as HTMLElement
  const btn = within(section).getByRole('button', { name: '60 min' })
  fireEvent.click(btn)
  expect(mockUpdateSettings).toHaveBeenCalledWith(
    expect.objectContaining({ eyeStrainCareIntervalMinutes: 60 })
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: FAIL — no "Eye Strain Care" section exists yet.

- [ ] **Step 3: Add the section**

In `src/settings/App.tsx`, add a new `<section>` immediately after the "Break Reminders" section's closing `</section>` (and before the "Bedtime Wind-Down" section), matching the exact structure of the Break Reminders section:

```tsx
        {/* Eye Strain Care */}
        <section className={sectionClass} style={sectionStyle}>
          <h2 className="text-sm font-display text-[#463a25]">Eye Strain Care</h2>
          <p className="text-xs text-[#7a6a4f]">
            A guided 4-step break for blinking, focal distance, posture, and screen brightness. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-[#463a25]">Enable eye-strain-care walkthrough</span>
            <input
              type="checkbox"
              checked={settings.eyeStrainCareEnabled}
              onChange={e => updateSettings({ eyeStrainCareEnabled: e.target.checked })}
              className="w-5 h-5 accent-[#2f5238]"
            />
          </label>
          <div>
            <label className="text-xs text-[#7a6a4f] mb-2 block">Remind me every</label>
            <div className="flex gap-2">
              {[20, 30, 45, 60].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ eyeStrainCareIntervalMinutes: mins })}
                  disabled={!settings.eyeStrainCareEnabled}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 border-[1.5px] ${
                    settings.eyeStrainCareIntervalMinutes === mins
                      ? 'bg-[#2f5238] text-[#f3ecd9] border-[#2f5238]'
                      : 'bg-[#f3ecd9] text-[#463a25] border-[rgba(54,43,26,.22)]'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>
        </section>
```

- [ ] **Step 4: Run the settings tests**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: PASS (new test + all existing tests, including the section-scoped "60 min" tests for Break Reminders and Posture & Hydration — the new section's own "60 min" button does not collide because each test scopes its query with `within(section)`).

- [ ] **Step 5: Commit**

```bash
git add src/settings/App.tsx src/settings/App.test.tsx
git commit -m "feat: settings UI for eye strain care (toggle + interval)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + the new `EyeStrainCareEngine` and settings tests).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `[check-worker-dom] OK — no DOM globals reachable from the service worker.`; `dist/mindfulOverlay.js` has no top-level `import`.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Load `dist/` as an unpacked extension and verify:
- Settings → Eye Strain Care shows the toggle (on) and interval presets (30 highlighted), independent of the Break Reminders section above it.
- Temporarily lower the interval (via Settings, minimum 20) and browse a normal page; after the interval, the "Eye Strain Care" card appears showing "Step 1 of 4" with a live countdown, auto-advancing through all 4 steps without any click.
- **Skip** at any step ends the walkthrough immediately; no break credit.
- Letting all 4 steps finish shows "Nicely done" with a **Done** button; clicking it dismisses the card and the dashboard's break count / Health score refresh (same mechanism as the Break Timer's `completed` path).
- Turning the toggle off stops the walkthrough from firing.
- Revert any temporary interval edit before finishing.

- [ ] **Step 5: Commit (only if step 4 required a revert or doc tweak)**

```bash
git add -A
git commit -m "chore: finalize eye strain care"
```

---

## Self-Review

- **Spec coverage:** settings model + messages (Task 1) ✓; `EyeStrainCareEngine` with fixed 4-step sequence + 1-min alarm + same gate order as `BreakTimerEngine` (Task 2, 4) ✓; sequential auto-advancing overlay reusing only existing CSS, Skip always available (Task 3) ✓; `deliverEyeStrainCare` with system-notification fallback (Task 3) ✓; `completed` credits `todaysSummary.breaks`, `skipped` does not (Task 4) ✓; idle/locked reset (Task 4) ✓; Settings UI toggle + interval picker (Task 5) ✓; independent of `BreakTimerEngine` — no modification to that file or its tests anywhere in this plan ✓; waking-hours guard 06:00–23:00 (Task 2) ✓; no API dependency ✓.
- **Placeholder scan:** none — every code step shows full code; commands have expected output.
- **Type consistency:** `EyeStrainStep { id, title, instruction, durationSec }` identical across Task 2's definition, its tests, Task 3's `deliverEyeStrainCare` parameter and the overlay's `EyeStrainStepPayload` (structurally identical), and the `SHOW_EYE_STRAIN_CARE` message payload defined in Task 1; engine method names `init`/`resetSession`/`evaluate`/`complete`/`skip` match between Task 2, its tests, and the Task 4 wiring; message type strings (`SHOW_EYE_STRAIN_CARE`, `EYE_STRAIN_RESPONSE`) and response union (`'completed' | 'skipped'`) identical across Tasks 1, 3, 4.
