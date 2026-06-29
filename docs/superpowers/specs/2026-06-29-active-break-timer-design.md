# Active Break / Movement Timer — Design

**Date:** 2026-06-29
**Status:** Approved (pending spec review)
**Feature:** First of a 5-part health-features series (break timer → bedtime wind-down → posture/hydration nudges → breathing reset → health trends). This spec covers **only the break timer**.

## Goal

A **local, deterministic** timer that, after a stretch of *continuous* screen time, opens a **guided active break** with a live on-screen countdown. It must work with **no OpenRouter API key**, complementing — not duplicating — the existing AI `CoachingEngine` rules (which are gated behind an API key + coaching hours).

## Motivation

`CoachingEngine` already has `long_session` (90 min) and `eye_health` (20-20-20) rules, but all rules require `coachingEnabled` + `openrouterApiKey` + within `coachingHours`, and they emit AI-generated text. A user without an API key gets **no break prompts at all**. The `eyeHealthReminders` setting exists but is currently unused (dead). The overlay (`mindfulOverlay.ts`, injected on `<all_urls>`) and `NotificationManager` are ready to reuse.

## Decisions (from brainstorming)

- **Experience:** Guided active break with a live countdown (not just a nudge).
- **Cadence:** Single configurable interval (default **45 min** of continuous use); the prompt rotates through eye + movement activities.
- **Default state:** **On by default**, configurable via Settings (toggle + interval picker).
- **No AI dependency:** fully local/deterministic.

## Architecture

### New `BreakTimerEngine` (`src/background/BreakTimerEngine.ts`)

A standalone engine instantiated at module level in `background/index.ts` (survives service-worker restarts the same way the other engines do). No OpenRouter dependency.

In-memory state:
- `sessionStart: number` — anchor for the continuous-use streak.
- `lastPromptAt: number` — when the last break prompt was shown (initialised to `sessionStart`).
- `snoozeUntil: number` — 0 unless snoozed.
- `promptIndex: number` — rotates through the prompt list.

Lifecycle:
- `init()` creates a `breakTimerTick` alarm at **1-minute** period (MV3 minimum) and sets `sessionStart = lastPromptAt = Date.now()`.
- `resetSession()` sets `sessionStart = lastPromptAt = Date.now()` — called from the existing `chrome.idle.onStateChanged` handler in `index.ts` when state is `idle` or `locked` (alongside the existing `coaching.resetSession()`).

### Tick logic (runs on `breakTimerTick`)

```
settings = getSettings()
if !settings.breakTimerEnabled: return
if settings.privateModeActive: return
hour = now.getHours(); if hour < 6 || hour >= 23: return   // waking-hours guard
now = Date.now()
if now < snoozeUntil: return
if minutesSince(lastPromptAt) < settings.breakIntervalMinutes: return
prompt = PROMPTS[promptIndex % PROMPTS.length]
promptIndex++
lastPromptAt = now
NotificationManager.deliverBreak(prompt)   // overlay → system-notification fallback
```

`evaluate()` returns the chosen prompt (or `null`) so it is unit-testable without side effects; the alarm handler in `index.ts` calls it and performs delivery.

### Prompt set (local constant in `BreakTimerEngine.ts`)

Rotating list of `{ id, title, instruction, durationSec }`:

1. `eye_reset` — "Look at something about 20 feet away." — 20s
2. `stand_stretch` — "Stand up and roll your shoulders back." — 30s
3. `walk_water` — "Take a short walk or grab some water." — 60s
4. `neck_loosen` — "Loosen your neck with slow circles." — 30s

Then repeats.

### Overlay (extend `src/content/mindfulOverlay.ts`)

Add handling for a new message type `SHOW_BREAK_PROMPT` with payload `{ title: string; instruction: string; durationSec: number }`. Render a **distinct card** (separate styling/markup from the existing mood check-in):

- Header label (e.g. "TIME TO MOVE"), the instruction text.
- Buttons: **Start**, **Skip**, **Snooze 5m**.
- **Start** → replaces the buttons with a live countdown (seconds ticking down from `durationSec`, runs entirely in the content script via `setInterval` — no background messaging during the countdown). At 0 it shows a **Done** state.
- Closing/finishing sends `BREAK_RESPONSE` with `{ response: 'completed' | 'skipped' | 'snoozed' }` back to the background via `chrome.runtime.sendMessage`, guarded by the same `chrome.runtime?.id` stale-context check used by the existing overlay.

The existing mood check-in card and `SHOW_MINDFUL_CHECKIN` path are unchanged.

### Delivery (`src/background/NotificationManager.ts`)

Add `deliverBreak(prompt)` (or extend `deliver`) that sends `SHOW_BREAK_PROMPT` to the active tab; on failure (restricted page) falls back to `chrome.notifications.create` with the prompt title + instruction. Mirrors the existing `deliver` flow.

### Response handling (`src/background/index.ts` message router)

Handle a new `BREAK_RESPONSE` message:
- **completed** → `breakTimer.completeBreak()`: reset `sessionStart` + `lastPromptAt` to now, and **increment `todaysSummary.breaks`** via `updateSettings` (the same field the Health score reads), then `scheduleRecompute()` so the dashboard updates.
- **snoozed** → `breakTimer.snooze()`: `snoozeUntil = now + 5*60_000`.
- **skipped** → `breakTimer.skip()`: `lastPromptAt = now` (skip this cycle, no break credit; streak not reset).

## Settings

Add two fields to `ExtensionSettings` (`src/shared/types.ts`) and to the defaults in `StorageManager`:

- `breakTimerEnabled: boolean` — default **true**.
- `breakIntervalMinutes: number` — default **45**.

The currently-unused `eyeHealthReminders` field is **removed** and replaced by `breakTimerEnabled` (single source of truth for break reminders). Any reference is updated.

**Settings UI** (`src/settings/App.tsx`): a new "Break reminders" section with:
- An enable toggle bound to `breakTimerEnabled`.
- An interval picker (segmented buttons or select) for **30 / 45 / 60 / 90** minutes, bound to `breakIntervalMinutes`, disabled when the toggle is off.

Follows the existing settings styling/patterns on the page.

## Messages (`src/shared/types.ts` `ExtensionMessage` union)

Add:
- `{ type: 'SHOW_BREAK_PROMPT'; payload: { title: string; instruction: string; durationSec: number } }`
- `{ type: 'BREAK_RESPONSE'; payload: { response: 'completed' | 'skipped' | 'snoozed' } }`

## Edge cases

- **Private mode** pauses prompts (checked each tick).
- **Restricted pages** (chrome://, web store) → system-notification fallback (no countdown; informational only).
- **Service-worker restart** resets the in-memory streak to now (≈ a break) — acceptable.
- **One prompt at a time**: the overlay removes any existing host before rendering; a new prompt won't stack on an open one.
- **Waking-hours guard** (6am–11pm) prevents late-night prompts, matching the existing idle-break-counting window.

## Testing

`src/background/BreakTimerEngine.test.ts` (vitest, mirroring existing engine tests):
- Fires a prompt once `breakIntervalMinutes` of continuous time elapses; not before.
- Returns `null` when disabled, in private mode, snoozed, or outside waking hours.
- `snooze()` defers the next prompt; `skip()` advances `lastPromptAt` without crediting a break and without resetting the streak; `completeBreak()` resets the streak and credits a break.
- `resetSession()` restarts the streak (idle/locked).
- Prompt rotation cycles through all four and wraps.

Plus a light assertion that `SHOW_BREAK_PROMPT` / `BREAK_RESPONSE` are wired in the message contract. The overlay DOM countdown is not unit-tested (no existing overlay tests); it is kept small and self-contained.

## Out of scope (future specs in this series)

Bedtime wind-down mode, posture/hydration scheduled nudges, breathing reset overlay, and the weekly health-trends dashboard view are separate features with their own specs.
