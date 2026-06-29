# Bedtime Wind-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local, AI-free bedtime wind-down feature: escalating evening reminders plus an opt-in warm screen tint that deepens toward a configurable bedtime.

**Architecture:** A background `WindDownEngine` (1-min alarm, mirrors `BreakTimerEngine`) delivers reminders via `NotificationManager` → a new wind-down overlay card. A separate self-contained content script `windDownTint.ts` renders a warm full-screen tint whose opacity is a pure function of the schedule. Four settings drive both; a dashboard `SleepNote` summarizes the night. No new scoring — the existing `lateNightMinutes` Health deduction stands.

**Tech Stack:** TypeScript, React (settings + dashboard), Chrome MV3 (`alarms`, `storage`, `notifications`, `tabs`), Vitest.

## Global Constraints

- No OpenRouter / network dependency anywhere in this feature — works with an empty API key.
- Times are stored as **minutes since midnight** (`number`). Defaults: `windDownStart = 1290` (21:30), `windDownBedtime = 1380` (23:00).
- Default state: `windDownEnabled = true` (reminders on), `windDownTintEnabled = false` (tint opt-in).
- Night window ends at **06:00** (`WAKE_HOUR = 6`); window math crosses midnight.
- Tint: max opacity **0.30**, `mix-blend-mode: multiply`, warm `rgb(255,150,60)`, `pointer-events:none`.
- Reminder cooldowns: **gentle 30 min**, **firm 20 min**; reminder **snooze 15 min**.
- `windDownTint.ts` is a content script and MUST stay dependency-free in the build output (no ES imports). It is a new rollup input and a new manifest content-script entry. The ~5 lines of window math are intentionally duplicated from the engine (a shared import would become a chunk a content script can't load).
- Follow existing patterns: engines are plain classes instantiated at module level in `background/index.ts`; content-script tests use `vi.useFakeTimers()` + dynamic `await import(...)`; settings mocks that are type-checked (not `as any`) must include every `ExtensionSettings` field.

---

### Task 1: Settings model + message types

**Files:**
- Modify: `src/shared/types.ts` (4 new `ExtensionSettings` fields; 2 new `ExtensionMessage` variants)
- Modify: `src/shared/StorageManager.ts:3-18` (4 defaults)
- Modify (as tsc requires): type-safe settings mocks in `src/newtab/components/Recommendations.test.tsx`, `src/newtab/components/WeeklyInsight.test.tsx`, `src/settings/App.test.tsx`, `src/sidepanel/App.test.tsx`, `src/shared/hooks/useStorage.test.ts`, `src/shared/hooks/useScores.test.ts`, and any others tsc flags
- Test: `src/shared/StorageManager.test.ts`

**Interfaces:**
- Produces: `ExtensionSettings.windDownEnabled: boolean`, `windDownTintEnabled: boolean`, `windDownStart: number`, `windDownBedtime: number`; messages `{ type: 'SHOW_WIND_DOWN'; payload: { message: string } }` and `{ type: 'WIND_DOWN_RESPONSE'; payload: { response: 'dismissed' | 'snoozed' } }`.

- [ ] **Step 1: Write the failing test**

Add to `src/shared/StorageManager.test.ts`:

```ts
describe('DEFAULT_SETTINGS wind-down', () => {
  it('defaults reminders on and tint off', () => {
    expect(DEFAULT_SETTINGS.windDownEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.windDownTintEnabled).toBe(false)
  })
  it('defaults wind-down 21:30 and bedtime 23:00 (minutes since midnight)', () => {
    expect(DEFAULT_SETTINGS.windDownStart).toBe(1290)
    expect(DEFAULT_SETTINGS.windDownBedtime).toBe(1380)
  })
})
```

(If `DEFAULT_SETTINGS` is not already imported in this test file, add `import { DEFAULT_SETTINGS } from './StorageManager'`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/StorageManager.test.ts`
Expected: FAIL — fields are `undefined` (and/or TS error: property does not exist).

- [ ] **Step 3: Add the type fields**

In `src/shared/types.ts`, inside `interface ExtensionSettings`, add after `breakIntervalMinutes: number`:

```ts
  windDownEnabled: boolean        // evening wind-down reminders
  windDownTintEnabled: boolean    // opt-in warm screen tint at night
  windDownStart: number           // wind-down start, minutes since midnight
  windDownBedtime: number         // target bedtime, minutes since midnight
```

In the same file, extend the `ExtensionMessage` union:

```ts
  | { type: 'SHOW_WIND_DOWN'; payload: { message: string } }
  | { type: 'WIND_DOWN_RESPONSE'; payload: { response: 'dismissed' | 'snoozed' } }
```

- [ ] **Step 4: Add the defaults**

In `src/shared/StorageManager.ts`, inside `DEFAULT_SETTINGS`, add after `breakIntervalMinutes: 45,`:

```ts
  windDownEnabled: true,
  windDownTintEnabled: false,
  windDownStart: 1290,
  windDownBedtime: 1380,
```

- [ ] **Step 5: Fix type-safe mocks**

Run `npx tsc --noEmit`. For every error of the form "property 'windDown…' is missing in type … ExtensionSettings", add these four lines to that mock's settings object literal:

```ts
    windDownEnabled: true,
    windDownTintEnabled: false,
    windDownStart: 1290,
    windDownBedtime: 1380,
```

Repeat until `npx tsc --noEmit` exits clean. (Mocks using `as any` do not need changes.)

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/shared/StorageManager.ts src/shared/StorageManager.test.ts src/newtab/components/Recommendations.test.tsx src/newtab/components/WeeklyInsight.test.tsx src/settings/App.test.tsx src/sidepanel/App.test.tsx src/shared/hooks/useStorage.test.ts src/shared/hooks/useScores.test.ts
git commit -m "feat: add wind-down settings and message types"
```

(Adjust the `git add` list to exactly the files you changed.)

---

### Task 2: WindDownEngine (reminders logic)

**Files:**
- Create: `src/background/WindDownEngine.ts`
- Test: `src/background/WindDownEngine.test.ts`

**Interfaces:**
- Consumes: `getSettings()` from `../shared/StorageManager` (reads `windDownEnabled`, `privateModeActive`, `windDownStart`, `windDownBedtime`).
- Produces:
  - `export function minutesOfDay(ts: number): number`
  - `export function inNightWindow(nowMin: number, startMin: number): boolean`
  - `export function pastBedtime(nowMin: number, startMin: number, bedtimeMin: number): boolean`
  - `export class WindDownEngine` with `init(): void`, `evaluate(): Promise<{ message: string; phase: 'gentle' | 'firm' } | null>`, `snooze(): void`.

- [ ] **Step 1: Write the failing tests**

Create `src/background/WindDownEngine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WindDownEngine } from './WindDownEngine'

vi.mock('../shared/StorageManager', () => ({
  getSettings: vi.fn().mockResolvedValue({
    windDownEnabled: true,
    privateModeActive: false,
    windDownStart: 1290,   // 21:30
    windDownBedtime: 1380, // 23:00
  }),
}))

async function settingsOnce(partial: Record<string, unknown>) {
  const { getSettings } = await import('../shared/StorageManager')
  vi.mocked(getSettings).mockResolvedValueOnce({
    windDownEnabled: true, privateModeActive: false, windDownStart: 1290, windDownBedtime: 1380, ...partial,
  } as any)
}

const at = (iso: string) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('WindDownEngine phase', () => {
  it('returns gentle between wind-down start and bedtime', async () => {
    at('2026-06-29T21:45:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('gentle')
  })

  it('returns firm after bedtime', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('firm')
  })

  it('returns firm after midnight (still in window)', async () => {
    at('2026-06-29T00:30:00')
    const engine = new WindDownEngine()
    engine.init()
    const r = await engine.evaluate()
    expect(r?.phase).toBe('firm')
  })
})

describe('WindDownEngine gates', () => {
  it('null before wind-down start', async () => {
    at('2026-06-29T20:00:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).toBeNull()
  })

  it('null after the wake hour (06:00)', async () => {
    at('2026-06-29T07:00:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).toBeNull()
  })

  it('null when disabled', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    await settingsOnce({ windDownEnabled: false })
    expect(await engine.evaluate()).toBeNull()
  })

  it('null in private mode', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    await settingsOnce({ privateModeActive: true })
    expect(await engine.evaluate()).toBeNull()
  })
})

describe('WindDownEngine cooldown + snooze', () => {
  it('gentle reminder respects the 30-minute cooldown', async () => {
    at('2026-06-29T21:45:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).not.toBeNull()
    at('2026-06-29T22:05:00') // +20 min
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T22:16:00') // +31 min from first
    expect(await engine.evaluate()).not.toBeNull()
  })

  it('snooze defers the next reminder by 15 minutes', async () => {
    at('2026-06-29T23:30:00')
    const engine = new WindDownEngine()
    engine.init()
    expect(await engine.evaluate()).not.toBeNull() // firm fires
    engine.snooze()
    at('2026-06-29T23:40:00') // +10 min
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T23:46:00') // +16 min, past snooze AND past 20-min firm cooldown? no — use snooze boundary
    // snooze window (15m) has passed; firm cooldown (20m) from 23:30 has NOT — so still null
    expect(await engine.evaluate()).toBeNull()
    at('2026-06-29T23:51:00') // +21 min from first firm
    expect(await engine.evaluate()).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/background/WindDownEngine.test.ts`
Expected: FAIL — cannot import `WindDownEngine`.

- [ ] **Step 3: Write the engine**

Create `src/background/WindDownEngine.ts`:

```ts
import { getSettings } from '../shared/StorageManager'

const WAKE_HOUR = 6
const GENTLE_COOLDOWN_MS = 30 * 60_000
const FIRM_COOLDOWN_MS = 20 * 60_000
const SNOOZE_MS = 15 * 60_000

const GENTLE_MESSAGES = [
  "It's past your wind-down time — start easing toward rest.",
  'Wind-down time. Consider dimming the lights and wrapping up soon.',
]
const FIRM_MESSAGES = [
  "It's past your bedtime. Screens now make it harder to fall asleep — consider stopping.",
  'Past bedtime. Your body rests better when the screens go off — time to stop.',
]

export function minutesOfDay(ts: number): number {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}

// Night window is [startMin .. WAKE_HOUR*60), crossing midnight.
export function inNightWindow(nowMin: number, startMin: number): boolean {
  return nowMin >= startMin || nowMin < WAKE_HOUR * 60
}

// Called only within the night window. In the evening (now >= start), it is past
// bedtime once now >= bedtime; after midnight (now < start) it is always past.
export function pastBedtime(nowMin: number, startMin: number, bedtimeMin: number): boolean {
  if (nowMin >= startMin) return nowMin >= bedtimeMin
  return true
}

/**
 * Deterministic, AI-free bedtime reminder engine. Escalates from gentle (after
 * wind-down start) to firm (after bedtime), with per-phase cooldowns and snooze.
 * State is in-memory; a service-worker restart resets it (at worst one extra
 * reminder).
 */
export class WindDownEngine {
  private lastFiredAt = 0
  private snoozeUntil = 0
  private gentleIdx = 0
  private firmIdx = 0

  init(): void {
    chrome.alarms.create('windDownTick', { periodInMinutes: 1 })
    this.lastFiredAt = 0
    this.snoozeUntil = 0
  }

  async evaluate(): Promise<{ message: string; phase: 'gentle' | 'firm' } | null> {
    const settings = await getSettings()
    if (!settings.windDownEnabled) return null
    if (settings.privateModeActive) return null

    const now = Date.now()
    const nowMin = minutesOfDay(now)
    if (!inNightWindow(nowMin, settings.windDownStart)) return null
    if (now < this.snoozeUntil) return null

    const firm = pastBedtime(nowMin, settings.windDownStart, settings.windDownBedtime)
    const cooldown = firm ? FIRM_COOLDOWN_MS : GENTLE_COOLDOWN_MS
    if (now - this.lastFiredAt < cooldown) return null

    this.lastFiredAt = now
    if (firm) {
      const message = FIRM_MESSAGES[this.firmIdx % FIRM_MESSAGES.length]
      this.firmIdx++
      return { message, phase: 'firm' }
    }
    const message = GENTLE_MESSAGES[this.gentleIdx % GENTLE_MESSAGES.length]
    this.gentleIdx++
    return { message, phase: 'gentle' }
  }

  snooze(): void {
    this.snoozeUntil = Date.now() + SNOOZE_MS
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/background/WindDownEngine.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/background/WindDownEngine.ts src/background/WindDownEngine.test.ts
git commit -m "feat: add WindDownEngine with gentle/firm phases and snooze"
```

---

### Task 3: deliverWindDown + wind-down overlay card

**Files:**
- Modify: `src/background/NotificationManager.ts`
- Modify: `src/content/mindfulOverlay.ts`

**Interfaces:**
- Consumes: message types `SHOW_WIND_DOWN` / `WIND_DOWN_RESPONSE` (Task 1).
- Produces: `NotificationManager.deliverWindDown(message: string): Promise<void>`; overlay listener for `SHOW_WIND_DOWN` that emits `WIND_DOWN_RESPONSE`.

- [ ] **Step 1: Add `deliverWindDown` to NotificationManager**

In `src/background/NotificationManager.ts`, add a comma after the `deliverBreak` method's closing brace, then add:

```ts
  async deliverWindDown(message: string): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_WIND_DOWN', payload: { message } })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Bedtime wind-down', message })
  }
```

- [ ] **Step 2: Add the wind-down card to the overlay**

In `src/content/mindfulOverlay.ts`, append at the end of the file (after the `SHOW_BREAK_PROMPT` listener). It reuses existing `OVERLAY_STYLES` classes (`.overlay`, `.title`, `.message`, `.actions`, `.btn`, `.close`); no new CSS:

```ts
function createWindDownOverlay(message: string): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Bedtime wind-down</div>
    <div class="message"></div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="snooze">Snooze 15m</button>
      <button class="btn btn-primary" data-action="dismiss">Dismiss</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const msgEl = card.querySelector('.message')
  if (msgEl) msgEl.textContent = message

  const report = (response: 'dismissed' | 'snoozed') => {
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'WIND_DOWN_RESPONSE', payload: { response } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  card.querySelector('.close')?.addEventListener('click', () => report('dismissed'))
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action
      report(action === 'snooze' ? 'snoozed' : 'dismissed')
    })
  })

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_WIND_DOWN') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createWindDownOverlay(msg.payload.message)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})
```

- [ ] **Step 3: Verify build + content-script purity**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds. Confirm `dist/mindfulOverlay.js` still has no top-level `import` statements (it is a content script).

- [ ] **Step 4: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/background/NotificationManager.ts src/content/mindfulOverlay.ts
git commit -m "feat: wind-down overlay card + deliverWindDown"
```

---

### Task 4: Warm tint content script

**Files:**
- Create: `src/content/windDownTint.ts`
- Modify: `vite.config.ts:22-24` (add rollup input)
- Modify: `public/manifest.json:26-42` (add content-script entry)
- Test: `src/content/windDownTint.test.ts`

**Interfaces:**
- Consumes: `chrome.storage.local` keys `windDownTintEnabled`, `windDownStart`, `windDownBedtime`.
- Produces: `export function windDownTintOpacity(nowMin: number, startMin: number, bedtimeMin: number, enabled: boolean): number`.

- [ ] **Step 1: Write the failing tests**

Create `src/content/windDownTint.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('windDownTintOpacity', () => {
  it('is 0 when disabled', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1350, 1290, 1380, false)).toBe(0)
  })

  it('is 0 before wind-down start', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1200, 1290, 1380, true)).toBe(0) // 20:00
  })

  it('ramps partially mid-evening', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    // halfway between 21:30 and 23:00 = 22:15 → ~0.15
    const o = windDownTintOpacity(1335, 1290, 1380, true)
    expect(o).toBeGreaterThan(0.13)
    expect(o).toBeLessThan(0.17)
  })

  it('holds max at/after bedtime', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(1380, 1290, 1380, true)).toBe(0.3) // 23:00
    expect(windDownTintOpacity(1400, 1290, 1380, true)).toBe(0.3) // 23:20
  })

  it('holds max after midnight, before wake hour', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(120, 1290, 1380, true)).toBe(0.3) // 02:00
  })

  it('is 0 at/after the wake hour', async () => {
    const { windDownTintOpacity } = await import('./windDownTint')
    expect(windDownTintOpacity(360, 1290, 1380, true)).toBe(0) // 06:00
    expect(windDownTintOpacity(420, 1290, 1380, true)).toBe(0) // 07:00
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/content/windDownTint.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the content script**

Create `src/content/windDownTint.ts`:

```ts
// Self-contained content script — no imports (must stay dependency-free so the
// build output has no ES import statements). The window math is intentionally
// duplicated from WindDownEngine; a shared import would become a chunk a content
// script cannot load.
const WAKE_HOUR = 6
const TINT_MAX = 0.3
const TINT_ID = 'wisemind-winddown-tint'

export function windDownTintOpacity(
  nowMin: number,
  startMin: number,
  bedtimeMin: number,
  enabled: boolean
): number {
  if (!enabled) return 0
  const wake = WAKE_HOUR * 60
  const inWindow = nowMin >= startMin || nowMin < wake
  if (!inWindow) return 0
  // minutes since wind-down start, accounting for the midnight wrap
  const sinceStart = nowMin >= startMin ? nowMin - startMin : nowMin + (1440 - startMin)
  const rampMinutes = bedtimeMin >= startMin ? bedtimeMin - startMin : bedtimeMin + (1440 - startMin)
  if (rampMinutes <= 0) return TINT_MAX
  const frac = Math.min(1, sinceStart / rampMinutes)
  return +(frac * TINT_MAX).toFixed(3)
}

function applyTint(opacity: number): void {
  let el = document.getElementById(TINT_ID) as HTMLDivElement | null
  if (opacity <= 0) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('div')
    el.id = TINT_ID
    el.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483646;' +
      'background:rgb(255,150,60);mix-blend-mode:multiply;transition:opacity 1s ease;'
    ;(document.documentElement || document.body)?.appendChild(el)
  }
  el.style.opacity = String(opacity)
}

function refresh(): void {
  if (!chrome.runtime?.id) return
  chrome.storage.local.get(
    { windDownTintEnabled: false, windDownStart: 1290, windDownBedtime: 1380 },
    (s: { windDownTintEnabled: boolean; windDownStart: number; windDownBedtime: number }) => {
      const d = new Date()
      const nowMin = d.getHours() * 60 + d.getMinutes()
      applyTint(windDownTintOpacity(nowMin, s.windDownStart, s.windDownBedtime, s.windDownTintEnabled))
    }
  )
}

refresh()
setInterval(refresh, 60_000)
chrome.storage.onChanged.addListener(refresh)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/content/windDownTint.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Register the rollup input**

In `vite.config.ts`, add to the `input` object (after the `mindfulOverlay` line):

```ts
        windDownTint: resolve(__dirname, 'src/content/windDownTint.ts'),
```

- [ ] **Step 6: Register the content script in the manifest**

In `public/manifest.json`, add a new object to the `content_scripts` array (after the `mindfulOverlay.js` entry):

```json
    {
      "matches": ["<all_urls>"],
      "js": ["windDownTint.js"],
      "run_at": "document_idle"
    }
```

- [ ] **Step 7: Build and verify the emitted content script is import-free**

Run: `npm run build`
Expected: build succeeds and emits `dist/windDownTint.js`. Verify its first line is not an `import` (content scripts cannot be ES modules). If it emitted an import, the file pulled in a shared chunk — ensure `windDownTint.ts` has no imports from other source modules.

- [ ] **Step 8: Commit**

```bash
git add src/content/windDownTint.ts src/content/windDownTint.test.ts vite.config.ts public/manifest.json
git commit -m "feat: warm screen tint content script for wind-down"
```

---

### Task 5: Wire WindDownEngine into the background

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `WindDownEngine` (Task 2), `NotificationManager.deliverWindDown` (Task 3).

- [ ] **Step 1: Import and instantiate**

In `src/background/index.ts`, add to the engine imports (after the `BreakTimerEngine` import):

```ts
import { WindDownEngine } from './WindDownEngine'
```

Add the instance after `const breakTimer = new BreakTimerEngine()`:

```ts
const windDown = new WindDownEngine()
```

Add its init after `breakTimer.init()`:

```ts
windDown.init()
```

- [ ] **Step 2: Handle the `windDownTick` alarm**

In the `chrome.alarms.onAlarm` listener, add after the `breakTimerTick` branch:

```ts
  if (alarm.name === 'windDownTick') {
    const r = await windDown.evaluate()
    if (r) {
      await NotificationManager.deliverWindDown(r.message)
    }
  }
```

- [ ] **Step 3: Handle `WIND_DOWN_RESPONSE` messages**

In the `chrome.runtime.onMessage.addListener` body, add after the `BREAK_RESPONSE` branch:

```ts
    if (message.type === 'WIND_DOWN_RESPONSE') {
      const payload = message.payload as { response: 'dismissed' | 'snoozed' }
      if (payload.response === 'snoozed') {
        windDown.snooze()
      }
      // 'dismissed' is acknowledged with no state change
      return false
    }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run src/background/index.test.ts && npm run build`
Expected: no type errors; background tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: wire wind-down alarm and response handler"
```

---

### Task 6: Settings UI — Bedtime Wind-Down section

**Files:**
- Modify: `src/settings/App.tsx`
- Test: `src/settings/App.test.tsx`

**Interfaces:**
- Consumes: `settings.windDownEnabled`, `settings.windDownTintEnabled`, `settings.windDownStart`, `settings.windDownBedtime`, `updateSettings`.

- [ ] **Step 1: Write the failing test**

Add to `src/settings/App.test.tsx`:

```ts
it('toggles the warm tint setting', async () => {
  render(<App />)
  const label = screen.getByText('Warm screen tint at night')
  const checkbox = label.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement
  fireEvent.click(checkbox)
  expect(mockUpdateSettings).toHaveBeenCalledWith(
    expect.objectContaining({ windDownTintEnabled: true })
  )
})
```

(The `useSettings` mock in this file already includes the four wind-down fields from Task 1; `windDownTintEnabled` is `false` there, so clicking sets it to `true`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: FAIL — no "Warm screen tint at night" text exists yet.

- [ ] **Step 3: Add the section**

In `src/settings/App.tsx`, add these two helpers above the `App` component (after the imports):

```tsx
const toHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
const fromHHMM = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}
```

Then add a new `<section>` after the "Break Reminders" section's closing `</section>`:

```tsx
        {/* Bedtime Wind-Down */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Bedtime Wind-Down</h2>
          <p className="text-xs text-slate-500">
            Evening reminders and an optional warm screen tint to help you ease toward sleep. Works without an API key.
          </p>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Wind-down reminders</span>
            <input
              type="checkbox"
              checked={settings.windDownEnabled}
              onChange={e => updateSettings({ windDownEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Warm screen tint at night</span>
            <input
              type="checkbox"
              checked={settings.windDownTintEnabled}
              onChange={e => updateSettings({ windDownTintEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-500"
            />
          </label>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Wind-down starts</label>
              <input
                type="time"
                value={toHHMM(settings.windDownStart)}
                onChange={e => updateSettings({ windDownStart: fromHHMM(e.target.value) })}
                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Target bedtime</label>
              <input
                type="time"
                value={toHHMM(settings.windDownBedtime)}
                onChange={e => updateSettings({ windDownBedtime: fromHHMM(e.target.value) })}
                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
        </section>
```

- [ ] **Step 4: Run the settings tests**

Run: `npx vitest run src/settings/App.test.tsx`
Expected: PASS (new test + existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/settings/App.tsx src/settings/App.test.tsx
git commit -m "feat: settings UI for bedtime wind-down"
```

---

### Task 7: Dashboard sleep note

**Files:**
- Create: `src/newtab/components/SleepNote.tsx`
- Modify: `src/newtab/App.tsx`

**Interfaces:**
- Consumes: `DailySummary` (`lateNightMinutes`), `ExtensionSettings` (`windDownEnabled`, `windDownStart`, `windDownBedtime`).

This task follows the existing untested-dashboard-component pattern (Timeline, EyeCare, etc. have no unit tests); it is verified by `tsc` + build.

- [ ] **Step 1: Create the component**

Create `src/newtab/components/SleepNote.tsx`:

```tsx
import type { DailySummary, ExtensionSettings } from '../../shared/types'

interface Props {
  summary: DailySummary
  settings: ExtensionSettings
}

function hhmm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function SleepNote({ summary, settings }: Props) {
  const lateMin = Math.round(summary.lateNightMinutes)
  const deduction = Math.min(20, Math.floor(lateMin / 10) * 2)
  const note =
    lateMin === 0
      ? 'No late-night screen time today — your sleep thanks you.'
      : `${lateMin} min after 11 PM today${deduction > 0 ? ` (−${deduction} to Health)` : ''}. Easing off earlier helps you fall asleep faster.`

  return (
    <div className="wm-panel p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-300">Sleep &amp; Wind-Down</h3>
        <span className="text-[11.5px] text-ink-600">
          {settings.windDownEnabled
            ? `${hhmm(settings.windDownStart)} → ${hhmm(settings.windDownBedtime)}`
            : 'reminders off'}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-500">{note}</p>
    </div>
  )
}
```

- [ ] **Step 2: Render it on the dashboard**

In `src/newtab/App.tsx`, add the import with the other component imports:

```tsx
import { SleepNote } from './components/SleepNote'
```

Then render it right after the `<EyeCare summary={summary} />` line:

```tsx
        {settings && <SleepNote summary={summary} settings={settings} />}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/newtab/components/SleepNote.tsx src/newtab/App.tsx
git commit -m "feat: dashboard sleep & wind-down note"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass (existing + `WindDownEngine` + `windDownTint`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `dist/windDownTint.js`, `dist/background.js`, `dist/mindfulOverlay.js`, `dist/settings.js`, `dist/newtab.js` emitted. Confirm `dist/windDownTint.js` and `dist/mindfulOverlay.js` have no top-level `import` statements.

- [ ] **Step 4: Manual smoke test (load unpacked)**

Load `dist/` as an unpacked extension and verify:
- Settings → Bedtime Wind-Down shows two toggles (reminders on, tint off) and two time pickers (21:30 / 23:00).
- Temporarily set wind-down start to a minute or two ahead and enable the tint; on a normal page the warm tint appears and deepens toward bedtime; after the wind-down minute a reminder overlay appears with Snooze 15m / Dismiss.
- Snooze defers the reminder; Dismiss closes it.
- Turning the tint toggle off removes the tint live (storage-change driven).
- Dashboard shows the Sleep & Wind-Down note with today's late-night minutes.
- Revert any temporary time changes.

- [ ] **Step 5: Commit (only if a revert/doc tweak was needed)**

```bash
git add -A
git commit -m "chore: finalize bedtime wind-down"
```

---

## Self-Review

- **Spec coverage:** 4 settings fields + UI (Task 1, 6) ✓; `WindDownEngine` gentle/firm + cooldowns + snooze + 1-min alarm (Task 2, 5) ✓; reminder delivery + overlay card (Task 3) ✓; warm tint content script with pure `windDownTintOpacity`, manifest + vite registration (Task 4) ✓; background wiring incl. `WIND_DOWN_RESPONSE` (Task 5) ✓; dashboard `SleepNote` (Task 7) ✓; night window 06:00, tint 0.30/multiply, cooldowns 30/20, snooze 15 — all in Global Constraints and the code ✓; private-mode + restricted-page + cross-midnight handled (Task 2, 4) ✓; no new scoring (reuses `lateNightMinutes`) ✓; no API dependency ✓.
- **Placeholder scan:** none — every code step shows full code; commands include expected output.
- **Type consistency:** `windDownTintOpacity(nowMin, startMin, bedtimeMin, enabled)` identical in Task 4 code and tests; engine return shape `{ message, phase: 'gentle'|'firm' }` matches between Task 2 and the Task 5 alarm handler; message payloads `{ message }` / `{ response: 'dismissed'|'snoozed' }` identical across Tasks 1, 3, 5; settings field names identical across Tasks 1, 4, 6, 7.
- **Note (Task 4 test side effects):** `windDownTint.ts` runs `refresh()` + `setInterval` + `chrome.storage.onChanged` at module load; tests neutralize this with `vi.useFakeTimers()` before the dynamic `await import(...)`, matching `activityMonitor.test.ts`.
