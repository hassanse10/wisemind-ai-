# Posture & Hydration Nudges — Design

**Date:** 2026-06-30
**Status:** Approved (pending spec review)
**Feature:** Third of the 5-part health-features series (break timer ✓ → bedtime wind-down ✓ → **posture/hydration nudges** → breathing reset → health trends). Covers only this feature.

## Goal

A lightweight, local nudge channel: while the user is actively at the screen, show a small auto-dismissing toast that alternates posture and hydration reminders. Fully local/deterministic (no OpenRouter / API key). Lighter than the break timer's guided cards — no buttons, no countdown, you keep working through it.

## Decisions (from brainstorming)

- **Delivery:** lightweight auto-dismiss toast (no buttons, no response).
- **Cadence:** one channel on a single configurable interval (default 40 min), rotating posture ↔ hydration.
- **Default:** on by default, configurable (toggle + interval picker).
- **Resolved specifics:** waking hours **06:00–23:00**; **2-min suppression** after a break/wind-down prompt; toast **~6 s** auto-dismiss; **no** system-notification fallback.

## Existing context this builds on

- `BreakTimerEngine` / `WindDownEngine` are the local-deterministic engine pattern to mirror: a 1-min alarm, `evaluate()` returns a payload or null, in-memory state, gates for enabled + private mode + a time window, `resetSession()` on idle.
- The overlay content script (`mindfulOverlay.ts`, `<all_urls>`) already renders mood/break/wind-down cards keyed to host id `wisemind-overlay-host`. This feature adds a SEPARATE toast element with its own id so the two channels never evict each other.
- `NotificationManager` delivers to the active tab with a fallback. This feature's delivery skips silently on restricted pages (no fallback).
- The idle/locked handler in `index.ts` already calls `coaching.resetSession()` and `breakTimer.resetSession()`.

## Settings

Add two fields to `ExtensionSettings` (`src/shared/types.ts`) and `DEFAULT_SETTINGS` (`StorageManager`):

- `wellnessNudgesEnabled: boolean` — default **true**.
- `wellnessNudgeIntervalMinutes: number` — default **40**.

**Settings UI** (`src/settings/App.tsx`): a new "Posture & Hydration" section with an enable toggle and an interval picker (segmented buttons: **30 / 40 / 60 / 90** min), the interval disabled when the toggle is off — mirroring the Break Reminders section.

## Component 1: `WellnessNudgeEngine` (background)

New `src/background/WellnessNudgeEngine.ts`, mirroring `BreakTimerEngine`. In-memory state: `lastNudgeAt`, `index`. A `wellnessTick` alarm at 1-min period.

Constants: `WAKE_START = 6`, `WAKE_END = 23`.

Prompt list — a single ordered array that ALTERNATES posture and hydration so rotation gives variety:

```ts
const NUDGES = [
  'Roll your shoulders back and sit up tall.',     // posture
  'Take a few sips of water.',                      // hydration
  'Unclench your jaw and relax your shoulders.',    // posture
  'Hydrate — have some water.',                     // hydration
  'Feet flat, back supported — reset your posture.',// posture
  'Time for a water break — stay hydrated.',        // hydration
]
```

`init(): void` — creates the `wellnessTick` alarm; sets `lastNudgeAt = Date.now()` (first nudge one interval out).

`resetSession(): void` — sets `lastNudgeAt = Date.now()` (called from the idle/locked handler so the user is only nudged while present).

`evaluate(): Promise<string | null>`:
```
settings = await getSettings()
if (!settings.wellnessNudgesEnabled) return null
if (settings.privateModeActive) return null
now = Date.now(); hour = new Date(now).getHours()
if (hour < WAKE_START || hour >= WAKE_END) return null
if (now - lastNudgeAt < settings.wellnessNudgeIntervalMinutes * 60_000) return null
message = NUDGES[index % NUDGES.length]
index++
lastNudgeAt = now
return message
```

`evaluate()` mutates state (`index`, `lastNudgeAt`) only when it returns a message.

## Component 2: No-stacking suppression (orchestration in `index.ts`)

A module-level `let lastOverlayShownAt = 0`. It is set to `Date.now()` whenever a **break** prompt or **wind-down** reminder is actually delivered (in the existing `breakTimerTick` and `windDownTick` alarm branches, right after `deliverBreak` / `deliverWindDown`).

In the new `wellnessTick` branch:
```
const message = await wellness.evaluate()
if (message && Date.now() - lastOverlayShownAt >= 2 * 60_000) {
  await NotificationManager.deliverNudge(message)
}
```
If a break/wind-down prompt fired within the last 2 minutes, the nudge is skipped (the engine has already advanced its interval, so the next nudge comes a full interval later). Suppression lives in the orchestrator, not the engine, keeping the engine independently testable.

## Component 3: Lightweight toast (extend `mindfulOverlay.ts`)

Add a handler for `SHOW_NUDGE` (payload `{ message: string }`) that renders a small toast:
- A separate host element with id `wisemind-nudge-toast` (NOT `wisemind-overlay-host`), so a nudge and a card can never evict each other. If a previous nudge toast is still present, it is removed first.
- Shadow DOM, a small pill (bottom-right or top-center), warm subtle styling, `pointer-events:none` so it never blocks clicks.
- Fades in, stays ~6 s, fades out, then removes itself (via `setTimeout`).
- **No buttons and no `chrome.runtime.sendMessage`** — fire-and-forget. Guarded so a torn-down timer can't throw.

The existing mood/break/wind-down cards and their listeners are untouched. The toast reuses its own minimal styles (added to `OVERLAY_STYLES` or inline in the toast element).

## Component 4: Delivery (`NotificationManager.deliverNudge`)

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
No system-notification fallback.

## Messages (`ExtensionMessage` union)

- `{ type: 'SHOW_NUDGE'; payload: { message: string } }`

(No response message — the toast is fire-and-forget.)

## Wiring (`src/background/index.ts`)

- Import + instantiate `WellnessNudgeEngine`; call `wellness.init()` alongside the other engine inits.
- Add `wellness.resetSession()` inside the existing `state === 'idle' || state === 'locked'` block.
- Set `lastOverlayShownAt = Date.now()` after `deliverBreak` (in `breakTimerTick`) and after `deliverWindDown` (in `windDownTick`).
- Add the `wellnessTick` alarm branch with the suppression check above.

## Edge cases

- Private mode pauses nudges.
- Restricted pages: delivery skips silently (no toast, no fallback).
- Waking-hours guard (06:00–23:00) avoids night toasts; wind-down covers the night.
- Service-worker restart resets the in-memory streak (at worst one delayed nudge).
- Idle/locked resets the interval, so nudges only fire while the user is present.
- A nudge toast and a break/wind-down card use different host ids and never evict each other; suppression additionally prevents them firing within 2 minutes.

## Testing

`WellnessNudgeEngine.test.ts` (Vitest + fake timers, mirroring the other engine tests):
- Fires once the interval elapses; not before.
- Returns null when disabled, in private mode, or outside waking hours.
- `resetSession()` restarts the interval.
- Rotation cycles through the NUDGES list and wraps (posture↔hydration alternation preserved).

Settings UI: a test that clicking an interval preset calls `updateSettings({ wellnessNudgeIntervalMinutes: <n> })` (mirrors the break-timer settings test).

The toast DOM and the index.ts suppression are not unit-tested (the toast is DOM, consistent with the overlay; the suppression is simple orchestration verified by build + manual smoke test).

## Out of scope (future specs)

Breathing reset overlay, weekly health-trends dashboard view.
