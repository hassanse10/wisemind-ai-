# Bedtime Wind-Down — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)
**Feature:** Second of the 5-part health-features series (break timer ✓ → **bedtime wind-down** → posture/hydration nudges → breathing reset → health trends). Covers only the wind-down feature.

## Goal

After a user-set wind-down time, gently steer the user toward sleep with escalating **reminders** and an opt-in **warming screen tint** that deepens toward bedtime. Fully local and deterministic (no OpenRouter / API key). Complements the existing AI-gated `late_night` coaching rule and ties into the existing `lateNightMinutes` Health-score deduction (no new scoring).

## Decisions (from brainstorming)

- **Behavior:** both reminders and a warm screen tint.
- **Schedule:** two times — wind-down start and target bedtime; tint ramps light→deep between them.
- **Defaults:** reminders **on** by default; tint **off** by default (opt-in).
- **Resolved specifics:** night window ends **06:00**; tint **MAX opacity 0.30** with `mix-blend-mode: multiply`; reminder cooldowns **gentle 30 min / firm 20 min**; reminder **snooze 15 min**.

## Existing context this builds on

- "Late night" is hardcoded as hour `>= 23 || < 6` in `ScoringEngine` and `CoachingEngine`. `ScoringEngine` deducts `min(20, floor(lateNightMinutes/10)*2)` from Health.
- `BreakTimerEngine` (just shipped) is the local-deterministic engine pattern to mirror: a 1-min alarm, `evaluate()` returns a payload or null, snooze/skip state, gates for enabled + private mode + time window.
- Content scripts are each a separate rollup entry and MUST be dependency-free in the build output (a helper shared with another entry becomes a chunk a content script can't import). The tint is therefore self-contained.
- The overlay (`mindfulOverlay.ts`, `<all_urls>`) and `NotificationManager` are reused.

## Settings

Add four fields to `ExtensionSettings` (`src/shared/types.ts`) and to `DEFAULT_SETTINGS` (`StorageManager`):

- `windDownEnabled: boolean` — reminders. Default **true**.
- `windDownTintEnabled: boolean` — warm tint. Default **false**.
- `windDownStart: number` — minutes since midnight. Default **1290** (21:30).
- `windDownBedtime: number` — minutes since midnight. Default **1380** (23:00).

**Settings UI** (`src/settings/App.tsx`): a new "Bedtime Wind-Down" section with two toggles (reminders, warm tint) and two `<input type="time">` pickers (wind-down start, target bedtime) converting between `"HH:MM"` and minutes-since-midnight. The tint toggle and both time pickers are independent controls; pickers are always enabled (they configure both reminders and tint).

## Component 1: `WindDownEngine` (background, reminders only)

New `src/background/WindDownEngine.ts`, mirroring `BreakTimerEngine`. In-memory state: `lastFiredAt`, `snoozeUntil`. A `windDownTick` alarm at 1-min period.

Constants: `WAKE_HOUR = 6` (window end), `GENTLE_COOLDOWN_MS = 30*60_000`, `FIRM_COOLDOWN_MS = 20*60_000`, `SNOOZE_MS = 15*60_000`.

Helper (module-scope, pure): `inNightWindow(nowMin, startMin)` — true when the current minute-of-day is within `[startMin … WAKE_HOUR*60]`, treating the window as crossing midnight (i.e. `nowMin >= startMin || nowMin < 360`).

`evaluate(): Promise<{ message: string; phase: 'gentle' | 'firm' } | null>`:
```
settings = await getSettings()
if (!settings.windDownEnabled) return null
if (settings.privateModeActive) return null
now = Date.now(); nowMin = minutesOfDay(now)
if (!inNightWindow(nowMin, settings.windDownStart)) return null
if (now < snoozeUntil) return null
phase = pastBedtime(nowMin, settings.windDownBedtime) ? 'firm' : 'gentle'
cooldown = phase === 'firm' ? FIRM_COOLDOWN_MS : GENTLE_COOLDOWN_MS
if (now - lastFiredAt < cooldown) return null
lastFiredAt = now
return { message: pickMessage(phase), phase }
```

`pastBedtime(nowMin, bedtimeMin)` handles the cross-midnight case: minutes after bedtime OR before the wake hour count as past bedtime. (E.g. bedtime 23:00 → 00:30 is "firm".)

`pickMessage(phase)` returns a static string from a small per-phase list:
- gentle: e.g. "It's past your wind-down time — start easing toward rest."
- firm: e.g. "It's past your bedtime. Screens now make it harder to fall asleep — consider stopping."

`snooze(): void` → `snoozeUntil = Date.now() + SNOOZE_MS`.
`init(): void` → creates the `windDownTick` alarm; sets `lastFiredAt = 0` so the first eligible tick can fire.

Delivery: new `NotificationManager.deliverWindDown(message: string)` sends `SHOW_WIND_DOWN` to the active tab; falls back to `chrome.notifications.create` on restricted pages.

## Component 2: Wind-down overlay card (`mindfulOverlay.ts`)

Add a handler for `SHOW_WIND_DOWN` (payload `{ message: string }`) rendering a small card (distinct from the mood and break cards): the message text + **Dismiss** and **Snooze 15m** buttons. Emits `WIND_DOWN_RESPONSE { response: 'dismissed' | 'snoozed' }` (guarded by `chrome.runtime?.id`). The existing mood and break cards are untouched. Reuses `OVERLAY_STYLES` plus any small additions.

## Component 3: Warm tint (new content script `src/content/windDownTint.ts`)

Self-contained, dependency-free, registered on `<all_urls>`. Exports a pure function for testability:

```ts
export function windDownTintOpacity(
  nowMin: number, startMin: number, bedtimeMin: number, enabled: boolean
): number
```
- Returns 0 if `!enabled` or outside `[startMin … WAKE_HOUR*60]` (cross-midnight).
- Ramps linearly 0 → `TINT_MAX (0.30)` between `startMin` and `bedtimeMin`.
- Holds `TINT_MAX` from `bedtimeMin` until the wake hour.
- Cross-midnight arithmetic: normalise minutes relative to `startMin` so the ramp and hold work past 00:00.

DOM behavior (not unit-tested, like the overlay): maintains one fixed full-screen `<div>` (id `wisemind-winddown-tint`), `pointer-events:none`, `position:fixed; inset:0`, warm amber background (e.g. `rgb(255,150,60)`), `mix-blend-mode: multiply`, `z-index` just below the overlay host. On load, every 60s, and on `chrome.storage.onChanged`, it reads `windDownTintEnabled`, `windDownStart`, `windDownBedtime` from `chrome.storage.local`, recomputes opacity via `windDownTintOpacity`, and sets the div's opacity (creating/removing the div as needed). The ~5 lines of window math are duplicated from the engine deliberately (bundling constraint).

Registered in `public/manifest.json` `content_scripts` as a new `<all_urls>` entry (`windDownTint.js`) and added as a rollup input in `vite.config.ts`.

## Component 4: Dashboard sleep note (`src/newtab`)

A compact `SleepNote` component on the dashboard showing: tonight's wind-down and bedtime times (from settings), today's `lateNightMinutes` (from `summary`), and the current Health sleep deduction (`min(20, floor(lateNightMinutes/10)*2)`), with one encouraging line. Read-only; reuses the `wm-panel` styling. Rendered in `newtab/App.tsx`.

## Wiring (`src/background/index.ts`)

- Import + instantiate `WindDownEngine`; call `windDown.init()` alongside the other engine inits.
- Alarm branch: `if (alarm.name === 'windDownTick') { const r = await windDown.evaluate(); if (r) await NotificationManager.deliverWindDown(r.message) }`.
- Message handler: `WIND_DOWN_RESPONSE` → `snoozed` calls `windDown.snooze()`; `dismissed` is a no-op (acknowledged).

## Messages (`ExtensionMessage` union)

- `{ type: 'SHOW_WIND_DOWN'; payload: { message: string } }`
- `{ type: 'WIND_DOWN_RESPONSE'; payload: { response: 'dismissed' | 'snoozed' } }`

## Edge cases

- Private mode pauses reminders (engine) — the tint also respects only its own toggle (privacy of the tint is not sensitive; it draws nothing from data). The tint reads only the schedule, never browsing data.
- Restricted pages: no tint and no overlay (content scripts can't run); reminders fall back to a system notification.
- Cross-midnight: both the engine window/phase math and the tint ramp handle `now` after 00:00 up to 06:00.
- Service-worker restart resets `lastFiredAt`/`snoozeUntil` (acceptable; at worst one extra reminder).
- One reminder card at a time (overlay removes any existing host before rendering).

## Testing

- `WindDownEngine.test.ts`: gentle vs firm phase by time; cooldowns (gentle 30 / firm 20) defer; snooze defers 15 min; returns null when disabled, in private mode, before wind-down start, or after 06:00; cross-midnight firm phase. Vitest + fake timers (`vi.setSystemTime`).
- `windDownTint.test.ts`: `windDownTintOpacity` returns 0 when disabled, 0 before start, partial mid-ramp, `TINT_MAX` at/after bedtime, `TINT_MAX` after midnight before 06:00, 0 at/after 06:00.
- Settings UI: a test that toggling the tint / changing a time calls `updateSettings` with the right field (mirrors the break-timer settings test).

## Out of scope (future specs)

Posture/hydration nudges, breathing reset overlay, weekly health-trends view.
