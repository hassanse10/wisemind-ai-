# Eye Strain Care — Design

**Date:** 2026-07-02
**Status:** Approved (pending spec review)
**Feature:** A new, independent health feature — a guided, skippable 4-step overlay that addresses the actual evidence-based causes of digital eye strain (blink rate, focal distance, brightness/glare, posture/distance), separate from the existing Break Timer.

## Goal

Every 30 minutes by default (configurable), while the user is present and awake, show an in-page guided walkthrough covering the four real causes of digital eye strain, one step at a time with a live countdown. Skippable at any point. Local, deterministic, no API key.

## Motivation

The existing `BreakTimerEngine` rotates through 4 generic prompts on a 45-min interval; only one of them (`eye_reset`, "look 20ft away," 20s) touches eye strain, and it only addresses one of the four real causes. This feature is comprehensive and dedicated, covering all four causes every time it fires, and is independent of the Break Timer (both can fire; they address different things).

## Decisions (from brainstorming)

- **Enforcement:** guided walkthrough, always skippable — not a hard block (the extension has no hard-blocking pattern anywhere; introducing one here would be inconsistent and risks being intrusive).
- **Relationship to Break Timer:** new, separate engine. No changes to `BreakTimerEngine`, `BREAK_PROMPTS`, or its tests.
- **Delivery:** in-page content-script overlay (Shadow DOM), same mechanism as the Break Timer's card — not a dedicated new-tab page.
- **Default:** on, every 30 minutes.
- **Completing it counts as a break:** increments `todaysSummary.breaks` (the same field the Break Timer increments), since it is a genuine screen break and this keeps the Health score behavior consistent across break-like features.

## Component 1: Settings

Add two fields to `ExtensionSettings` (`src/shared/types.ts`) and `DEFAULT_SETTINGS` (`src/shared/StorageManager.ts`):

- `eyeStrainCareEnabled: boolean` — default **true**.
- `eyeStrainCareIntervalMinutes: number` — default **30**.

**Settings UI** (`src/settings/App.tsx`): a new "Eye Strain Care" section, styled like the existing "Break Reminders" section — an enable toggle and an interval picker (20 / 30 / 45 / 60 min segmented buttons), interval disabled when the toggle is off.

## Component 2: `EyeStrainCareEngine` (background)

New `src/background/EyeStrainCareEngine.ts`, structurally mirroring `BreakTimerEngine` (same shape: `init()`, `resetSession()`, `evaluate()`, `complete()`, `skip()`; same waking-hours guard 06:00–23:00; same in-memory-state-resets-on-worker-restart tradeoff). No snooze (not requested; keep it simple — Skip already exists for "not now").

```ts
export interface EyeStrainStep {
  id: string
  title: string
  instruction: string
  durationSec: number
}

export const EYE_STRAIN_STEPS: EyeStrainStep[] = [
  { id: 'blink', title: 'Blink', instruction: 'Blink slowly and fully, ten times.', durationSec: 10 },
  { id: 'look_away', title: 'Look away', instruction: 'Look at something at least 20 feet away.', durationSec: 20 },
  { id: 'posture', title: 'Check your posture', instruction: 'Sit up straight, screen at eye level, about an arm’s length away.', durationSec: 15 },
  { id: 'brightness', title: 'Check your brightness', instruction: 'Match your screen brightness to the room around you.', durationSec: 10 },
]
```

`evaluate(): Promise<EyeStrainStep[] | null>` — gated by `eyeStrainCareEnabled`, `privateModeActive`, waking hours, and the interval (`eyeStrainCareIntervalMinutes`), following the exact same gate order and mutate-only-on-return-value discipline as `BreakTimerEngine.evaluate()`. On success, returns the full `EYE_STRAIN_STEPS` array (all 4 steps every time — not rotating) and advances `lastFiredAt`.

`complete(): void` — resets `lastFiredAt` to now (restart the interval), called on full completion.
`skip(): void` — resets `lastFiredAt` to now (restart the interval; no break credit), called on Skip at any step.
`resetSession(): void` — resets `lastFiredAt` to now, called from the idle/locked handler alongside the other engines.

## Component 3: Overlay card (extend `src/content/mindfulOverlay.ts`)

A new builder, `createEyeStrainOverlay(steps: EyeStrainStep[])`, added alongside `createBreakOverlay`/`createWindDownOverlay` — same Shadow DOM + `OVERLAY_STYLES` (Fable-painted) approach, dependency-free (no imports; the file's content-script purity constraint continues to apply).

Behavior — this is a new pattern (sequence, not a single countdown):
- Shows "Step N of 4," the current step's `title`/`instruction`, and a live countdown starting at `durationSec`.
- **Skip** button always visible; clicking it immediately ends the walkthrough at whatever step it's on.
- When a step's countdown reaches 0, auto-advance to the next step (no click required) with a fresh countdown.
- After the 4th step completes, show a brief "Nicely done" state (matching the Break Timer's done-state pattern) before the card can be dismissed — mirrors `createBreakOverlay`'s `.break-done` treatment.
- On finish or skip, sends `EYE_STRAIN_RESPONSE` with `{ response: 'completed' | 'skipped' }` via `chrome.runtime.sendMessage`, guarded by the same `chrome.runtime?.id` stale-context check used elsewhere in this file.

New message listener: `chrome.runtime.onMessage.addListener` branch for `SHOW_EYE_STRAIN_CARE` with payload `{ steps: EyeStrainStep[] }`, removing any existing `wisemind-overlay-host` first (same one-card-at-a-time convention as the other three cards).

## Component 4: Delivery (`src/background/NotificationManager.ts`)

Add `deliverEyeStrainCare(steps: EyeStrainStep[]): Promise<void>`, structurally identical to `deliverBreak`: send `SHOW_EYE_STRAIN_CARE` to the active tab; on failure (restricted page) fall back to `chrome.notifications.create` with a generic title/message (e.g. title "Eye strain care", message "Time for a quick eye-care break — blink, look away, check posture and brightness.").

## Component 5: Wiring (`src/background/index.ts`)

- Import + instantiate `EyeStrainCareEngine`; call `.init()` alongside the other engines.
- New `eyeStrainTick` alarm branch: `evaluate()` → if non-null, `deliverEyeStrainCare(steps)`.
- New `EYE_STRAIN_RESPONSE` message handler:
  - `completed` → `eyeStrainCare.complete()`, then increment `todaysSummary.breaks` by 1 (same read-modify-write pattern as `BREAK_RESPONSE`'s `completed` branch), then `scheduleRecompute()`.
  - `skipped` → `eyeStrainCare.skip()` (no break credit).
- Add `eyeStrainCare.resetSession()` to the existing idle/locked block, alongside `breakTimer.resetSession()`.

## Messages (`ExtensionMessage` union, `src/shared/types.ts`)

- `{ type: 'SHOW_EYE_STRAIN_CARE'; payload: { steps: EyeStrainStep[] } }`
- `{ type: 'EYE_STRAIN_RESPONSE'; payload: { response: 'completed' | 'skipped' } }`

## Edge cases

- Private mode pauses it (checked each tick), same as every other reminder engine.
- Restricted pages fall back to a system notification (informational only, no interactive walkthrough).
- Waking-hours guard (06:00–23:00) — no overnight prompts (the Wind-Down feature already owns nighttime behavior).
- Service-worker restart resets the in-memory interval streak — acceptable, same tradeoff as every other engine.
- Can fire independently of / alongside the Break Timer; no coordination between the two (accepted per the "new, separate feature" decision — occasional overlap is fine, they address different things).

## Testing

`src/background/EyeStrainCareEngine.test.ts` (Vitest + fake timers, mirroring `BreakTimerEngine.test.ts`): fires once the interval elapses; not before; null when disabled/private/outside-waking-hours; `complete()`/`skip()`/`resetSession()` all restart the interval; `evaluate()` returns all 4 `EYE_STRAIN_STEPS` in order every time it fires.

Settings UI: a test that clicking an interval preset calls `updateSettings({ eyeStrainCareIntervalMinutes: <n> })`, mirroring the Break Reminders settings test (including the section-scoped `within()` query needed to disambiguate from other interval-picker sections' identically-labeled buttons).

The overlay's step-sequencing/auto-advance DOM logic is not unit-tested, consistent with how the Break Timer's countdown DOM is untested in this codebase.

## Out of scope

No dashboard panel, no new scoring beyond the existing `breaks` field, no cross-engine coordination with the Break Timer or Wind-Down, no snooze (Skip covers "not now").
