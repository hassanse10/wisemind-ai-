# Active Break / Movement Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, deterministic timer that, after a configurable stretch of continuous screen time, opens a guided active break (live countdown) — working with no OpenRouter API key.

**Architecture:** A new background `BreakTimerEngine` runs on a 1-minute `breakTimerTick` alarm, decides when a break is due (interval + waking-hours + enabled + not-private + not-snoozed), and delivers a rotating prompt through `NotificationManager` to the `mindfulOverlay` content script (system-notification fallback). The overlay renders a countdown card and reports the user's response back; completed breaks reset the streak and credit `todaysSummary.breaks`.

**Tech Stack:** TypeScript, React (settings UI), Chrome MV3 (`alarms`, `idle`, `tabs`, `notifications`), Vitest.

## Global Constraints

- No OpenRouter / network dependency anywhere in this feature — it must work with an empty API key.
- Reuse the existing `eyeHealthReminders` boolean as the break-timer enable flag (do NOT remove the field; many tests reference it). Add exactly one new settings field: `breakIntervalMinutes: number`, default `45`.
- Waking-hours guard: prompts only between **06:00 and 23:00** local (hour `>= 6 && < 23`).
- Snooze duration: **5 minutes** (`5 * 60_000` ms).
- Prompt set is exactly the 4 rotating prompts defined in Task 2, in that order.
- Follow existing code patterns: engines are plain classes instantiated at module level in `background/index.ts`; tests use Vitest with the `chrome` mock from `src/test/setup.ts`.

---

### Task 1: Settings model + message types

**Files:**
- Modify: `src/shared/types.ts` (add `breakIntervalMinutes` field; add two `ExtensionMessage` variants)
- Modify: `src/shared/StorageManager.ts:3-18` (add default)
- Test: `src/shared/StorageManager.test.ts`

**Interfaces:**
- Produces: `ExtensionSettings.breakIntervalMinutes: number`; messages `{ type: 'SHOW_BREAK_PROMPT'; payload: { title: string; instruction: string; durationSec: number } }` and `{ type: 'BREAK_RESPONSE'; payload: { response: 'completed' | 'skipped' | 'snoozed' } }`.

- [ ] **Step 1: Write the failing test**

Add to `src/shared/StorageManager.test.ts` (inside the existing top-level `describe`, or a new one):

```ts
import { DEFAULT_SETTINGS } from './StorageManager'

describe('DEFAULT_SETTINGS break timer', () => {
  it('defaults the break interval to 45 minutes', () => {
    expect(DEFAULT_SETTINGS.breakIntervalMinutes).toBe(45)
  })
  it('keeps eyeHealthReminders enabled by default (break-timer flag)', () => {
    expect(DEFAULT_SETTINGS.eyeHealthReminders).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/StorageManager.test.ts`
Expected: FAIL — `breakIntervalMinutes` is `undefined` (and/or TS error: property does not exist on `ExtensionSettings`).

- [ ] **Step 3: Add the field to the type**

In `src/shared/types.ts`, inside `interface ExtensionSettings`, add after the `eyeHealthReminders: boolean` line:

```ts
  breakIntervalMinutes: number   // minutes of continuous use before a break prompt
```

In the same file, extend the `ExtensionMessage` union (add these two members):

```ts
  | { type: 'SHOW_BREAK_PROMPT'; payload: { title: string; instruction: string; durationSec: number } }
  | { type: 'BREAK_RESPONSE'; payload: { response: 'completed' | 'skipped' | 'snoozed' } }
```

- [ ] **Step 4: Add the default**

In `src/shared/StorageManager.ts`, inside `DEFAULT_SETTINGS`, add after `eyeHealthReminders: true,`:

```ts
  breakIntervalMinutes: 45,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/shared/StorageManager.test.ts`
Expected: PASS

- [ ] **Step 6: Type-check (no other typed literal broke)**

Run: `npx tsc --noEmit`
Expected: no errors. (Existing test mocks pass partial settings via `as any`, so they are unaffected.)

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/StorageManager.ts src/shared/StorageManager.test.ts
git commit -m "feat: add breakIntervalMinutes setting and break message types"
```

---

### Task 2: BreakTimerEngine (core logic)

**Files:**
- Create: `src/background/BreakTimerEngine.ts`
- Test: `src/background/BreakTimerEngine.test.ts`

**Interfaces:**
- Consumes: `getSettings()` from `../shared/StorageManager` (reads `eyeHealthReminders`, `privateModeActive`, `breakIntervalMinutes`).
- Produces:
  - `export interface BreakPrompt { id: string; title: string; instruction: string; durationSec: number }`
  - `export const BREAK_PROMPTS: BreakPrompt[]`
  - `export class BreakTimerEngine` with: `init(): void`, `resetSession(): void`, `evaluate(): Promise<BreakPrompt | null>`, `completeBreak(): void`, `snooze(): void`, `skip(): void`.

- [ ] **Step 1: Write the failing tests**

Create `src/background/BreakTimerEngine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BreakTimerEngine, BREAK_PROMPTS } from './BreakTimerEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    eyeHealthReminders: true,
    privateModeActive: false,
    breakIntervalMinutes: 45,
  }),
}))

const NOON = new Date('2026-06-29T12:00:00')
const min = (n: number) => n * 60_000

async function mockSettingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    eyeHealthReminders: true, privateModeActive: false, breakIntervalMinutes: 45, ...partial,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOON)
})
afterEach(() => vi.useRealTimers())

describe('BreakTimerEngine interval', () => {
  it('fires once the interval has elapsed', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('does not fire before the interval', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(44)))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('BreakTimerEngine gates', () => {
  it('returns null when disabled (eyeHealthReminders false)', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    await mockSettingsOnce({ eyeHealthReminders: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null in private mode', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    await mockSettingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })

  it('returns null outside waking hours (before 6am)', async () => {
    vi.setSystemTime(new Date('2026-06-29T02:00:00'))
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date('2026-06-29T02:45:00'))
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('BreakTimerEngine responses', () => {
  it('snooze re-prompts after 5 minutes regardless of interval', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.snooze()
    vi.setSystemTime(new Date(NOON.getTime() + min(47)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('skip waits a full interval and gives no immediate re-prompt', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.skip()
    vi.setSystemTime(new Date(NOON.getTime() + min(50)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(90)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('completeBreak restarts the streak', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(45)))
    expect(await engine.evaluate()).not.toBeNull()
    engine.completeBreak()
    vi.setSystemTime(new Date(NOON.getTime() + min(80)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(90)))
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('resetSession restarts the streak (idle/locked)', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    vi.setSystemTime(new Date(NOON.getTime() + min(30)))
    engine.resetSession()
    vi.setSystemTime(new Date(NOON.getTime() + min(70)))
    expect(await engine.evaluate()).toBeNull()
    vi.setSystemTime(new Date(NOON.getTime() + min(75)))
    expect(await engine.evaluate()).not.toBeNull()
  })
})

describe('BreakTimerEngine rotation', () => {
  it('rotates through all prompts then wraps', async () => {
    const engine = new BreakTimerEngine()
    engine.init()
    const ids: string[] = []
    for (let i = 1; i <= BREAK_PROMPTS.length + 1; i++) {
      vi.setSystemTime(new Date(NOON.getTime() + min(45 * i)))
      const p = await engine.evaluate()
      ids.push(p!.id)
    }
    expect(ids.slice(0, BREAK_PROMPTS.length)).toEqual(BREAK_PROMPTS.map(p => p.id))
    expect(ids[BREAK_PROMPTS.length]).toBe(BREAK_PROMPTS[0].id)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/background/BreakTimerEngine.test.ts`
Expected: FAIL — cannot import `BreakTimerEngine` (module does not exist).

- [ ] **Step 3: Write the engine**

Create `src/background/BreakTimerEngine.ts`:

```ts
import { getSettings } from '../shared/StorageManager'

export interface BreakPrompt {
  id: string
  title: string
  instruction: string
  durationSec: number
}

// Rotating set of guided active breaks. Order is significant (tests assert it).
export const BREAK_PROMPTS: BreakPrompt[] = [
  { id: 'eye_reset', title: 'Rest your eyes', instruction: 'Look at something about 20 feet away and let your eyes relax.', durationSec: 20 },
  { id: 'stand_stretch', title: 'Stand & stretch', instruction: 'Stand up and roll your shoulders slowly back.', durationSec: 30 },
  { id: 'walk_water', title: 'Move a little', instruction: 'Take a short walk or grab a glass of water.', durationSec: 60 },
  { id: 'neck_loosen', title: 'Loosen your neck', instruction: 'Roll your neck gently in slow circles, each direction.', durationSec: 30 },
]

const SNOOZE_MS = 5 * 60_000
const WAKE_START = 6  // inclusive hour
const WAKE_END = 23   // exclusive hour

/**
 * Deterministic, AI-free break reminder timer. Tracks the continuous-use streak
 * and decides when the next guided break is due. State is in-memory; a service
 * worker restart resets the streak (≈ a break), which is acceptable.
 */
export class BreakTimerEngine {
  private lastBreakAt = Date.now()
  private overrideNextAt = 0   // when > 0, supersedes the interval (snooze)
  private promptIndex = 0

  init(): void {
    chrome.alarms.create('breakTimerTick', { periodInMinutes: 1 })
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** Called when the user goes idle/locked — the streak resets. */
  resetSession(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** Decide whether to show a prompt now. Mutates state only when it returns one. */
  async evaluate(): Promise<BreakPrompt | null> {
    const settings = await getSettings()
    if (!settings.eyeHealthReminders) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const hour = new Date(now).getHours()
    if (hour < WAKE_START || hour >= WAKE_END) return null
    if (this.overrideNextAt === 0 && now < this.lastBreakAt + settings.breakIntervalMinutes * 60_000) return null
    if (this.overrideNextAt > 0 && now < this.overrideNextAt) return null

    const prompt = BREAK_PROMPTS[this.promptIndex % BREAK_PROMPTS.length]
    this.promptIndex++
    this.lastBreakAt = now
    this.overrideNextAt = 0
    return prompt
  }

  /** User finished the guided break — restart the streak. */
  completeBreak(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }

  /** User snoozed — re-prompt in 5 minutes regardless of the interval. */
  snooze(): void {
    this.overrideNextAt = Date.now() + SNOOZE_MS
  }

  /** User skipped — no break credit; wait a full interval before re-prompting. */
  skip(): void {
    this.lastBreakAt = Date.now()
    this.overrideNextAt = 0
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/background/BreakTimerEngine.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/BreakTimerEngine.ts src/background/BreakTimerEngine.test.ts
git commit -m "feat: add BreakTimerEngine with interval, snooze, skip, rotation"
```

---

### Task 3: Delivery + guided-break overlay

**Files:**
- Modify: `src/background/NotificationManager.ts`
- Modify: `src/content/mindfulOverlay.ts`

**Interfaces:**
- Consumes: `BreakPrompt`-shaped object `{ title, instruction, durationSec }`; message types `SHOW_BREAK_PROMPT` / `BREAK_RESPONSE` from Task 1.
- Produces: `NotificationManager.deliverBreak(prompt: { title: string; instruction: string; durationSec: number }): Promise<void>`; overlay listener for `SHOW_BREAK_PROMPT` that emits `BREAK_RESPONSE`.

- [ ] **Step 1: Add `deliverBreak` to NotificationManager**

In `src/background/NotificationManager.ts`, add a second method to the object (keep `deliver` unchanged):

```ts
  async deliverBreak(prompt: { title: string; instruction: string; durationSec: number }): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_BREAK_PROMPT', payload: prompt })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: prompt.title, message: prompt.instruction })
  },
```

- [ ] **Step 2: Add the break card to the overlay**

In `src/content/mindfulOverlay.ts`, append these break-card styles to the `OVERLAY_STYLES` template string (before its closing backtick):

```css
  .break-instruction { font-size: 14px; line-height: 1.5; color: #cbd5e1; margin-bottom: 16px; }
  .countdown { font-size: 40px; font-weight: 700; text-align: center; color: #34d399; margin: 8px 0 16px; font-variant-numeric: tabular-nums; }
  .break-done { font-size: 14px; text-align: center; color: #34d399; margin-bottom: 16px; }
```

Then add the break-overlay builder and listener at the end of the file (after the existing `chrome.runtime.onMessage.addListener`):

```ts
function createBreakOverlay(title: string, instruction: string, durationSec: number): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Time to move</div>
    <div class="message"></div>
    <div class="break-instruction"></div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="skip">Skip</button>
      <button class="btn btn-secondary" data-action="snooze">Snooze 5m</button>
      <button class="btn btn-primary" data-action="start">Start</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const msgEl = card.querySelector('.message')
  if (msgEl) msgEl.textContent = title
  const instrEl = card.querySelector('.break-instruction')
  if (instrEl) instrEl.textContent = instruction

  let timer: ReturnType<typeof setInterval> | null = null

  const report = (response: 'completed' | 'skipped' | 'snoozed') => {
    if (timer) clearInterval(timer)
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'BREAK_RESPONSE', payload: { response } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  const startCountdown = () => {
    const actions = card.querySelector('.actions')
    if (actions) actions.remove()
    if (instrEl) instrEl.remove()
    const count = document.createElement('div')
    count.className = 'countdown'
    let remaining = durationSec
    count.textContent = String(remaining)
    card.appendChild(count)
    timer = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        count.textContent = String(remaining)
        return
      }
      if (timer) clearInterval(timer)
      count.remove()
      const done = document.createElement('div')
      done.className = 'break-done'
      done.textContent = '✓ Nicely done — your eyes and body thank you.'
      card.appendChild(done)
      const ok = document.createElement('button')
      ok.className = 'btn btn-primary'
      ok.textContent = 'Done'
      ok.addEventListener('click', () => report('completed'))
      card.appendChild(ok)
    }, 1000)
  }

  card.querySelector('.close')?.addEventListener('click', () => report('skipped'))
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action
      if (action === 'start') startCountdown()
      else if (action === 'snooze') report('snoozed')
      else report('skipped')
    })
  })

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_BREAK_PROMPT') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createBreakOverlay(msg.payload.title, msg.payload.instruction, msg.payload.durationSec)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/background/NotificationManager.ts src/content/mindfulOverlay.ts
git commit -m "feat: guided break overlay with countdown + deliverBreak"
```

---

### Task 4: Wire BreakTimerEngine into the background

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `BreakTimerEngine` (Task 2), `NotificationManager.deliverBreak` (Task 3), existing `getSettings` / `updateSettings` / `scheduleRecompute`.

- [ ] **Step 1: Import and instantiate the engine**

In `src/background/index.ts`, add to the imports near the other engine imports (after the `NotificationManager` import on line 6):

```ts
import { BreakTimerEngine } from './BreakTimerEngine'
```

Add the instance alongside the others (after `const achievements = new AchievementsEngine()`):

```ts
const breakTimer = new BreakTimerEngine()
```

Add its init alongside the others (after `coaching.init()`):

```ts
breakTimer.init()
```

- [ ] **Step 2: Handle the `breakTimerTick` alarm**

In the `chrome.alarms.onAlarm` listener, add a new branch (e.g. after the `coachingTick` branch):

```ts
  if (alarm.name === 'breakTimerTick') {
    const prompt = await breakTimer.evaluate()
    if (prompt) {
      await NotificationManager.deliverBreak(prompt)
    }
  }
```

- [ ] **Step 3: Reset the streak on idle/locked**

In the `chrome.idle.onStateChanged` listener, inside the existing `if (state === 'idle' || state === 'locked')` block (which already calls `coaching.resetSession()`), add:

```ts
    breakTimer.resetSession()
```

- [ ] **Step 4: Handle `BREAK_RESPONSE` messages**

In the `chrome.runtime.onMessage.addListener` body, add a new branch (e.g. after the `COACHING_RESPONSE` branch):

```ts
    if (message.type === 'BREAK_RESPONSE') {
      const payload = message.payload as { response: 'completed' | 'skipped' | 'snoozed' }
      void (async () => {
        if (payload.response === 'completed') {
          breakTimer.completeBreak()
          const settings = await getSettings()
          if (settings.todaysSummary) {
            await updateSettings({
              todaysSummary: { ...settings.todaysSummary, breaks: settings.todaysSummary.breaks + 1 },
            })
          }
          scheduleRecompute()
        } else if (payload.response === 'snoozed') {
          breakTimer.snooze()
        } else {
          breakTimer.skip()
        }
      })()
      return false
    }
```

- [ ] **Step 5: Type-check and run the background test**

Run: `npx tsc --noEmit && npx vitest run src/background/index.test.ts`
Expected: no type errors; existing background tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: wire break timer alarm, idle reset, and response handler"
```

---

### Task 5: Settings UI — Break reminders section

**Files:**
- Modify: `src/settings/App.tsx:213-221` (replace the Eye Health Reminders checkbox) and add a new section
- Test: `src/settings/App.test.tsx` (existing test must still pass; add interval coverage)

**Interfaces:**
- Consumes: `settings.eyeHealthReminders` (enable flag), `settings.breakIntervalMinutes`, `updateSettings`.

- [ ] **Step 1: Write the failing test**

Add to `src/settings/App.test.tsx` (a new `it`, matching the file's existing render/click style):

```ts
it('updates the break interval when a preset is clicked', async () => {
  const { updateSettings } = await import('../shared/StorageManager')
  render(<App />)
  const btn = await screen.findByRole('button', { name: '60 min' })
  fireEvent.click(btn)
  expect(updateSettings).toHaveBeenCalledWith(
    expect.objectContaining({ breakIntervalMinutes: 60 })
  )
})
```

(If `render`, `screen`, `fireEvent` are not yet imported in this test file, add them from `@testing-library/react`. Confirm the mocked `settings` object the test provides includes `breakIntervalMinutes: 45` — add it to the existing mock settings literal in this file.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: FAIL — no button named "60 min" exists yet.

- [ ] **Step 3: Replace the Eye Health Reminders control with a Break Reminders section**

In `src/settings/App.tsx`, remove the existing block (lines ~213-221):

```tsx
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Eye Health Reminders</span>
            <input
              type="checkbox"
              checked={settings.eyeHealthReminders}
              onChange={e => updateSettings({ eyeHealthReminders: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
```

Then add a new `<section>` after the Coaching Preferences section's closing `</section>` (the section ending around line 222):

```tsx
        {/* Break Reminders */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Break Reminders</h2>
          <p className="text-xs text-slate-500">
            Guided eye &amp; movement breaks during continuous screen time. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable break reminders</span>
            <input
              type="checkbox"
              checked={settings.eyeHealthReminders}
              onChange={e => updateSettings({ eyeHealthReminders: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Remind me every</label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map(mins => (
                <button
                  key={mins}
                  onClick={() => updateSettings({ breakIntervalMinutes: mins })}
                  disabled={!settings.eyeHealthReminders}
                  className={`flex-1 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 ${
                    settings.breakIntervalMinutes === mins
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

- [ ] **Step 4: Run the settings tests**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: PASS (the new interval test and the existing settings tests).

- [ ] **Step 5: Commit**

```bash
git add src/settings/App.tsx src/settings/App.test.tsx
git commit -m "feat: settings UI for break reminders (toggle + interval)"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + the new BreakTimerEngine and settings tests).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `dist/background.js`, `dist/mindfulOverlay.js`, and `dist/settings.js` are emitted.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Load `dist/` as an unpacked extension in Chrome and verify:
- Settings → Break Reminders shows the toggle (on) and interval presets (45 highlighted).
- Temporarily lower the interval in `BreakTimerEngine.ts` (or set `breakIntervalMinutes` to a small value via settings — note the UI minimum is 30; for a fast check, edit the engine default locally and rebuild) and confirm: after the interval of continuous browsing on a normal page, the "Time to move" overlay appears; **Start** runs the countdown to **Done**; clicking **Done** dismisses it and the dashboard's break count / Health score refresh.
- **Snooze 5m** re-shows the prompt after 5 minutes; **Skip** dismisses without crediting a break.
- Turning the toggle off stops prompts.
- Revert any temporary interval edit before finishing.

- [ ] **Step 5: Commit (only if step 4 required a revert or doc tweak)**

```bash
git add -A
git commit -m "chore: finalize active break timer"
```

---

## Self-Review

- **Spec coverage:** BreakTimerEngine + 1-min alarm (Task 2, 4) ✓; guided countdown overlay (Task 3) ✓; rotating 4 prompts (Task 2) ✓; single configurable interval default 45 (Task 1, 5) ✓; on-by-default + Settings toggle/interval (Task 1, 5) ✓; completed → reset + credit `todaysSummary.breaks` (Task 4) ✓; snooze 5m / skip semantics (Task 2, 4) ✓; private-mode + waking-hours + restricted-page fallback (Task 2, 3) ✓; idle/locked reset (Task 4) ✓; no API-key dependency ✓. Deviation from spec: `eyeHealthReminders` is **reused** as the enable flag rather than removed/renamed to `breakTimerEnabled` (avoids churn across ~9 test files); documented in Global Constraints.
- **Placeholder scan:** none — every code step shows full code; commands have expected output.
- **Type consistency:** `BreakPrompt` shape `{ id, title, instruction, durationSec }` and message payloads `{ title, instruction, durationSec }` / `{ response }` are identical across Tasks 1–4; method names `evaluate` / `completeBreak` / `snooze` / `skip` / `resetSession` / `init` match between engine, tests, and the index.ts handler.
