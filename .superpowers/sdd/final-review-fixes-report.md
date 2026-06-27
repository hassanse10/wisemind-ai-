# Final Review Fixes Report

Date: 2026-06-27

## Overview

Six integration/correctness defects were identified and fixed in the WiseMind AI Chrome extension. All fixes required reading the target files first, then making minimal targeted edits.

---

## FIX 1 (Critical): Wire dropped background message handlers

**File:** `src/background/index.ts`

**Problem:** The `chrome.runtime.onMessage` listener only handled `GET_SETTINGS`. Content scripts emitting `SHORT_WATCHED`, `ACTIVITY_SIGNAL`, and `COACHING_RESPONSE` were silently dropped.

**Fix:**
- Added imports: `isPrivateMode` from StorageManager, `addShortVideoSession` and `addCoachingEvent` from db, `CoachingEvent` type from types.
- Extended the existing onMessage listener with three new branches:
  - `SHORT_WATCHED`: async IIFE checks private mode before calling `addShortVideoSession` with a new UUID, timestamp, platform, count, duration. Returns `false`.
  - `COACHING_RESPONSE`: calls `addCoachingEvent` with `type: 'mindful_checkin'`, maps `response` and `mood` to correct union types. Returns `false`.
  - `ACTIVITY_SIGNAL`: updates `lastActivityTime` module-level variable. Returns `false`.
- Added `let lastActivityTime = Date.now()` at module level.
- `GET_SETTINGS` still returns `true` to keep async channel open; all other handlers return `false`.

---

## FIX 2 (Critical): Register mindfulOverlay in manifest

**File:** `public/manifest.json`

**Problem:** `mindfulOverlay.js` was never injected into pages. The overlay listens for `SHOW_MINDFUL_CHECKIN` but couldn't receive it.

**Fix:** Added a new content-script entry:
```json
{ "matches": ["<all_urls>"], "js": ["mindfulOverlay.js"], "run_at": "document_idle" }
```
Placed between `activityMonitor.js` and `shortVideoDetector.js` entries.

**Verification:** `Get-Content public/manifest.json | ConvertFrom-Json` parsed cleanly; content_scripts now shows `activityMonitor.js`, `mindfulOverlay.js`, `shortVideoDetector.js`.

---

## FIX 3 (Critical): Restore valid mentor personalities in Settings

**File:** `src/settings/App.tsx`, `src/settings/App.test.tsx`

**Problem:** `PERSONALITIES` array contained `id: 'strict'` and `id: 'motivational'` which are not valid `MentorPersonality` values (causes TS errors). Engines key on `coach`, `mindful`, `funny` which were unreachable from the UI.

**Fix:** Replaced with exactly 5 valid `MentorPersonality` values:
```ts
{ id: 'wise',     label: 'Wise Mentor',       desc: 'Calm, thoughtful guidance' }
{ id: 'friendly', label: 'Friendly Friend',   desc: 'Relaxed and encouraging' }
{ id: 'coach',    label: 'Tough Coach',        desc: 'Disciplined, motivates action' }
{ id: 'mindful',  label: 'Mindfulness Guide',  desc: 'Peaceful, stress-reducing' }
{ id: 'funny',    label: 'Funny Companion',    desc: 'Playful, light humour' }
```

**Test update:** Changed `'renders all four personality options'` to `'renders all five personality options'` and replaced 'Strict Coach' / 'Motivational Guide' assertions with 'Tough Coach', 'Mindfulness Guide', 'Funny Companion'.

**Settings null-guard fix:** Moved `if (!settings) return <div />` after the handler function definitions, and added `if (!settings) return` inside `addDomain` and `removeDomain` so TypeScript can verify they are null-safe without the closure-scope ambiguity.

---

## FIX 4 (Important): Broadcast SCORE_UPDATE after computeScores alarm

**File:** `src/background/index.ts`

**Problem:** The `computeScores` alarm branch called `computeAndStore()` but never broadcast a `SCORE_UPDATE` message. Open UIs would not refresh unless coaching also fired.

**Fix:** Changed:
```ts
// before
await scoring.computeAndStore()

// after
const scores = await scoring.computeAndStore()
chrome.runtime.sendMessage({ type: 'SCORE_UPDATE', payload: scores }).catch(() => {})
```
`ScoringEngine.computeAndStore()` already returns `Promise<Scores>`, so no signature change needed.

---

## FIX 5 (Important): Make continuousMinutes reset after breaks

**File:** `src/background/CoachingEngine.ts`, `src/background/index.ts`

**Problem:** `sessionStartTime` was set once in `init()` and never reset. `continuousMinutes` measured "since service worker start," not continuous browsing time.

**Fix:**
- Added `resetSession()` public method to `CoachingEngine`:
  ```ts
  resetSession(): void { this.sessionStartTime = Date.now() }
  ```
- In `index.ts`, updated the `chrome.idle.onStateChanged` listener to call `coaching.resetSession()` when state becomes `'idle'` or `'locked'`.

---

## FIX 6 (Important): Add typecheck gate and fix strict type errors

**File:** `package.json` + multiple source files

**Added script:**
```json
"typecheck": "tsc --noEmit"
```

**Errors fixed:**

| File | Error | Fix |
|------|-------|-----|
| `src/settings/App.tsx` | `'strict'`/`'motivational'` not valid `MentorPersonality` | Replaced with valid ids (see FIX 3) |
| `src/settings/App.tsx` | `settings` possibly null in `addDomain`/`removeDomain` | Added `if (!settings) return` guards; moved early-return after function definitions |
| `src/background/TrackingEngine.ts` | `chrome.tabs.TabActiveInfo` not in @types/chrome | Changed to `chrome.tabs.OnActivatedInfo` (correct name in this version) |
| `src/shared/StorageManager.ts` | `chrome.storage.local.get` type mismatch | Cast `DEFAULT_SETTINGS as unknown as string[]` and result `as unknown as ExtensionSettings` |
| `src/test/setup.ts` | `global` not in scope (DOM+ES2020 lib) | Changed to `globalThis` |
| `src/test/integration.smoke.test.ts` | `global.fetch` (×3) | Changed to `globalThis.fetch` |
| `src/test/integration.smoke.test.ts` | `vi.mocked(chrome.tabs.query).mockResolvedValueOnce(Tab[])` | Cast `chrome.tabs.query as any` |
| `src/test/integration.smoke.test.ts` | `assert: { type: 'json' }` deprecated | Changed to `with: { type: 'json' }` |
| `src/background/ClassifierEngine.test.ts` | `global.fetch` | Changed to `globalThis.fetch` |
| `src/background/CoachingEngine.test.ts` | `global.fetch` | Changed to `globalThis.fetch` |
| `src/background/NotificationManager.test.ts` | `vi.mocked(chrome.tabs.query).mockResolvedValue(Tab[])` | Cast `chrome.tabs.query as any` |
| `src/content/activityMonitor.ts` | File not a module (no export) | Added `export {}` at bottom |

---

## New Tests Added

**src/background/index.test.ts** (10 new tests):
- `SHORT_WATCHED` → calls `addShortVideoSession` when not in private mode
- `SHORT_WATCHED` → skips `addShortVideoSession` in private mode
- `COACHING_RESPONSE` → calls `addCoachingEvent` with correct type/userResponse/mood
- `ACTIVITY_SIGNAL` → returns false (doesn't keep channel open)
- `GET_SETTINGS` → returns true (keeps channel open)
- `computeScores` alarm → sends `SCORE_UPDATE` with scores payload
- `idle` state → calls `coaching.resetSession()`
- `locked` state → calls `coaching.resetSession()`
- `active` state → does NOT call `coaching.resetSession()`

**src/background/CoachingEngine.test.ts** (1 new test):
- `resetSession()` does not throw and can be called multiple times

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` (tsc --noEmit) | PASS — exit 0, no errors |
| `npm test` | PASS — 143 tests passing (was 133) |
| `npm run build` | PASS — built in 709ms |
| No top-level `import` in content scripts | PASS — grep returned nothing |
| `manifest.json` valid JSON | PASS — ConvertFrom-Json succeeded |
| `manifest.json` lists `mindfulOverlay.js` | PASS — confirmed in content_scripts |

---

## Files Modified

- `src/background/index.ts` — FIX 1, 4, 5
- `src/background/CoachingEngine.ts` — FIX 5
- `src/settings/App.tsx` — FIX 3, 6
- `src/settings/App.test.tsx` — FIX 3 (test update)
- `public/manifest.json` — FIX 2
- `package.json` — FIX 6 (typecheck script)
- `src/shared/StorageManager.ts` — FIX 6
- `src/background/TrackingEngine.ts` — FIX 6
- `src/test/setup.ts` — FIX 6
- `src/test/integration.smoke.test.ts` — FIX 6 + new test awareness
- `src/background/ClassifierEngine.test.ts` — FIX 6
- `src/background/CoachingEngine.test.ts` — FIX 6 + new tests
- `src/background/NotificationManager.test.ts` — FIX 6
- `src/content/activityMonitor.ts` — FIX 6
- `src/background/index.test.ts` — new tests for FIX 1, 4, 5
- `.superpowers/sdd/final-review-fixes-report.md` — this report
