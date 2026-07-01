# WiseMind AI "Fable" Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark-navy theme with the warm-paper "Fable" theme across every surface, visually matching `docs/design/WiseMind-AI-Fable.html`.

**Architecture:** Task 1 rewrites the shared theme foundation (fonts, color tokens, helpers) + category colors — this flips every token-based usage automatically. Tasks 2–9 re-skin each surface's hardcoded dark classes/inline styles to the Fable palette + motifs, matching the corresponding mockup region. Visual-only: no behavior, data, engine, or messaging changes.

**Tech Stack:** Tailwind CSS v4 (tokens via `@theme` in `src/shared/index.css`), React, TypeScript, Vite, Vitest.

## Nature of this plan

This is a **visual translation**, not transcription. Task 1 contains exact, complete code. Tasks 2–9 are **re-skin briefs**: each names the files, the mockup region in `docs/design/WiseMind-AI-Fable.html` to reproduce, and applies the shared **Class Mapping** below. The implementer edits each component's classes/inline styles to match the mockup — preserving all existing markup structure, props, logic, text, and `data-*`/`aria-*`/test-visible strings. Only visual classes/inline styles change.

## Global Constraints

- **Visual only.** Do not change component logic, props, state, effects, event handlers, message types, copy/labels, or any text an existing test asserts. If a change would alter rendered text or `role`/label queried by a test, do not make it.
- **Palette (exact):** page `#e9dfc9`; cards `#faf5e9` (outer) / `#fffdf5` (inner) / `#f3ecd9` (tan); ink `#362b1a`→`#463a25`→`#5d5138`→`#7a6a4f`→`#8a7a5c`→`#a3947a`; brand green `#2f5238` / `#4d7c57`; accents health/reading `#4d7c57`, productivity/work `#58789f`, learning `#c9892f` (dark text `#96650f`), social `#7c5a80`, shorts `#b85c38` (dark `#8a4326`); tint panels green `#eef0e0`, blue `#e8edf2`, amber `#f6ead2`, red `#f4e7e0`; hairlines `rgba(54,43,26,.1/.18/.22/.25/.3/.35)`.
- **Fonts:** headings/titles/score numbers → `font-display` (Young Serif); everything else → Alegreya Sans (the default `font-sans`, set in Task 1).
- **Motifs:** outer page cards use `.wm-card` (cream, 2px `#362b1a` border, `box-shadow:6px 8px 0 rgba(54,43,26,.18)`); inner cards use cream `#fffdf5` + `1.5px solid rgba(54,43,26,.25)` + radius 13–18px; category cards use the matching tint bg + colored 1.5px border; pill buttons (radius 20–24px) primary = green fill/`#f3ecd9` text, secondary = transparent + `1.5px rgba(54,43,26,.35)` border + `#5d5138` text.
- **Class Mapping (dark → Fable)** — apply throughout Tasks 2–9:
  - `bg-navy-950/900/850/800` → keep (Task 1 retargets these tokens to paper). Prefer these tokens over hardcoded hex where a component already uses them.
  - `bg-slate-800/60`, `bg-white/[0.025]`, `bg-white/[0.04]`, `bg-slate-900/…` (cards) → `bg-[#fffdf5]` (or `.wm-panel`).
  - outer full-page container cards → `.wm-card`.
  - `border-slate-700/50`, `border-white/[0.06]`, `border-white/[0.08]` → `border-[1.5px] border-[rgba(54,43,26,.25)]`.
  - `text-slate-100/200/300` & `text-ink-100/200` (headings/strong) → `text-ink-100` (`#362b1a`); add `font-display` on titles/section headings/score numbers.
  - `text-slate-400/500/600` & `text-ink-400/500/600` (muted) → `text-ink-400`/`text-ink-500`.
  - `bg-blue-600`, `bg-blue-500`, `bg-gradient-to-r from-blue…`, `wm-brand-grad` primary buttons → `bg-[#2f5238] text-[#f3ecd9] border-[1.5px] border-[#2f5238]`.
  - secondary/ghost buttons → `bg-transparent border-[1.5px] border-[rgba(54,43,26,.35)] text-[#5d5138]`.
  - accent text (`text-blue-400`, `text-learn`, etc.) → the corresponding Fable accent hex.
  - progress-bar track → `bg-[rgba(54,43,26,.1)]`; fill → the metric's accent color.
  - category-tinted card: green `bg-[#eef0e0] border-[#4d7c57]`, blue `bg-[#e8edf2] border-[#58789f]`, amber `bg-[#f6ead2] border-[#c9892f]`, red `bg-[#f4e7e0] border-[#b85c38]`.
- **After every task:** `npx tsc --noEmit`, `npx vitest run` (all pass — a re-skin must not break behavioral tests; if one asserts an old color literal, that's a real conflict — STOP and report), `npm run build` (includes `check:worker` — must pass). The build guard must stay green.
- The mockup's `{{ }}` placeholders and "Sage" coach copy are mock data — **do not wire them**; keep the app's existing dynamic content.

---

### Task 1: Theme foundation (tokens, fonts, helpers, category colors)

**Files:**
- Modify: `src/shared/index.css` (full rewrite of the token/helper region)
- Modify: `src/shared/constants.ts` (the `CATEGORY_COLORS` map only)

**Interfaces:**
- Produces: retargeted `@theme` tokens (`--color-navy-*` now paper surfaces, `--color-ink-*` now a brown scale, accents = Fable), `font-sans`=Alegreya Sans, `font-display`=Young Serif; `.wm-card`/`.wm-panel`/`.wm-brand-grad` repainted; `CATEGORY_COLORS` in Fable hues.

- [ ] **Step 1: Replace `src/shared/index.css`**

Replace the entire file with:

```css
@import url('https://fonts.googleapis.com/css2?family=Young+Serif&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap');
@import "tailwindcss";

/* ── WiseMind "Fable" design tokens (warm paper) ────────────────────────── */
@theme {
  --font-sans: 'Alegreya Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-display: 'Young Serif', ui-serif, Georgia, 'Times New Roman', serif;

  /* surfaces — token NAMES kept for compatibility; values are now paper */
  --color-navy-950: #e9dfc9; /* page background */
  --color-navy-900: #faf5e9; /* primary card */
  --color-navy-850: #fffdf5; /* inner / light card */
  --color-navy-800: #f3ecd9; /* tan panel */

  /* score / category accents */
  --color-health: #4d7c57;
  --color-prod: #58789f;
  --color-learn: #c9892f;
  --color-social: #7c5a80;
  --color-reading: #4d7c57;
  --color-shorts: #b85c38;
  --color-cyan: #58789f;

  /* brand + tint panels */
  --color-brand-green: #2f5238;
  --color-tint-green: #eef0e0;
  --color-tint-blue: #e8edf2;
  --color-tint-amber: #f6ead2;
  --color-tint-red: #f4e7e0;

  /* text — brown ink scale (ink-100 strongest/darkest → ink-700 faintest) */
  --color-ink-100: #362b1a;
  --color-ink-200: #463a25;
  --color-ink-300: #5d5138;
  --color-ink-400: #7a6a4f;
  --color-ink-500: #8a7a5c;
  --color-ink-600: #a3947a;
  --color-ink-700: #b3a488;
}

/* ── base ──────────────────────────────────────────────────────────────── */
html,
body {
  margin: 0;
  font-family: var(--font-sans);
  background: #e9dfc9;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* ── reusable helpers ──────────────────────────────────────────────────── */
@layer components {
  .wm-card {
    background: #faf5e9;
    border: 2px solid #362b1a;
    border-radius: 20px;
    box-shadow: 6px 8px 0 rgb(54 43 26 / 0.18);
  }
  .wm-brand-grad {
    /* kept name; the Fable brand mark is a solid green badge, not a gradient */
    background: #2f5238;
  }
  .wm-panel {
    background: #fffdf5;
    border: 1.5px solid rgb(54 43 26 / 0.25);
    border-radius: 16px;
  }
}

@keyframes wmpulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
@keyframes wmfloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
.wm-anim-pulse { animation: wmpulse 2s infinite; }
.wm-anim-float { animation: wmfloat 5s ease-in-out infinite; }
```

- [ ] **Step 2: Retarget `CATEGORY_COLORS` in `src/shared/constants.ts`**

Replace the `CATEGORY_COLORS` object (keep all 14 keys, `CATEGORY_LABELS` and everything else unchanged):

```ts
export const CATEGORY_COLORS: Record<Category, string> = {
  learning: '#c9892f', programming: '#58789f', productivity: '#58789f',
  ai_tools: '#4d7c57', reading: '#4d7c57', entertainment: '#7c5a80',
  gaming: '#b85c38', social_media: '#7c5a80', news: '#8a7a5c', shopping: '#c9892f',
  finance: '#4d7c57', health: '#4d7c57', communication: '#58789f', other: '#a3947a',
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: no type errors; all tests pass; build succeeds and `check:worker` prints OK.

- [ ] **Step 4: Commit**

```bash
git add src/shared/index.css src/shared/constants.ts
git commit -m "feat(design): Fable theme foundation — paper tokens, fonts, category colors"
```

---

### Task 2: Popup surface

**Files:** `src/popup/App.tsx`, `src/popup/components/ScoreRing.tsx`, `src/popup/components/ScreenTimeBar.tsx`, `src/popup/components/CoachingCard.tsx`

**Reference:** the "Popup · 400×580" screen in `docs/design/WiseMind-AI-Fable.html`.

Apply the Class Mapping. Specifics:
- Outer container (`src/popup/App.tsx`, root `div`, currently `bg-navy-900`): make it the cream popup — `bg-[#faf5e9]` with `text-ink-100`; drop the dark radial-gradient glows (remove those decorative divs or set them to transparent). Keep width/height.
- Logo badge: round `#2f5238` circle, `2px solid #362b1a`, containing the leaf SVG (already `BRAND_MARK`) with stroke `#f3ecd9`. Wordmark "WiseMind" in `font-display`; date in `text-ink-500`.
- Settings gear button: `border-[1.5px] border-[rgba(54,43,26,.3)] text-ink-400`, transparent bg.
- `ScoreRing.tsx`: track color → `#f3ecd9` (or `rgba(54,43,26,.18)`); progress stroke stays the passed accent `color`; the number/label use `font-display` / `text-ink-500`. The `color` prop values are passed by callers (update those call sites' hexes to Fable accents: Health `#4d7c57`, Productivity `#58789f`, Learning `#c9892f`).
- `Pill` (productivity/learning): `bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.25)]`; label `text-ink-300`; value in `font-display` in the accent color; track `bg-[rgba(54,43,26,.1)]`, fill = accent.
- `ScreenTimeBar.tsx`: title eyebrow `text-ink-500 font-extrabold`; total in `font-display`; bars use `CATEGORY_COLORS`; legend dots + `text-ink-400`.
- `CoachingCard.tsx`: green-tint card `bg-[#eef0e0] border-[1.5px] border-[#4d7c57]`; the coach avatar green badge; label like "COACH" in `text-[#2f5238] font-extrabold`; message `text-ink-200`; buttons: primary green, secondary ghost per mapping.
- Quick-links row: each a `bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.22)]` pill with icon + `text-ink-300` label.

- [ ] **Step 1: Re-skin the four popup files** per the brief above, applying the Class Mapping; preserve all logic/props/text.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/popup && npm run build` (all pass; worker guard OK).
- [ ] **Step 3: Commit** — `git add src/popup && git commit -m "feat(design): re-skin popup to Fable"`

---

### Task 3: Dashboard core

**Files:** `src/newtab/App.tsx`, `src/newtab/components/ScoreCards.tsx`, `src/newtab/components/Timeline.tsx`, `src/newtab/components/ScreenTimeDetails.tsx`

**Reference:** the "New Tab · Full Dashboard" top region (top bar, hero, score cards, timeline) in the mockup.

- `src/newtab/App.tsx`: page bg `#e9dfc9`; wrap the content in a `.wm-card` cream sheet (the mockup is one large bordered card) OR keep the existing max-width column but set the page bg to paper and remove the dark radial glows. Top bar: green logo badge + `font-display` wordmark; add the amber streak chip style + date to the right (`bg-[#f6ead2] border-[1.5px] border-[#c9892f] text-[#96650f]`). Hero line in `font-display` ~33px `text-ink-100` with the learning span underlined amber (`text-[#96650f] border-b-[3px] border-[#c9892f]`). Bottom action buttons → secondary pill style; keep "Breathe"/"Settings"/"Open AI Coach" labels and handlers.
- `ScoreCards.tsx`: three category-tinted cards — Health green (`#eef0e0`/`#4d7c57`), Productivity blue (`#e8edf2`/`#58789f`), Learning amber (`#f6ead2`/`#c9892f`); each with the `ScoreRing` (track `#faf5e9`), a `font-display` label, a muted description, and the ✦-rating row (fill = accent, empties `opacity:.3`). Reuse the existing `ScoreRing` from popup.
- `Timeline.tsx`: inner cream card `.wm-panel`; `font-display` title; bars use `CATEGORY_COLORS`; hour labels `text-ink-500`; hover tooltip on `#faf5e9` with brown border.
- `ScreenTimeDetails.tsx`: cream card; `font-display` heading; category rows with `CATEGORY_COLORS` dots + `text-ink-300` labels + bars (track `rgba(54,43,26,.1)`); the stat grid tiles on `#f3ecd9`.

- [ ] **Step 1: Re-skin the four files** per the brief; preserve logic/props/text.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/newtab && npm run build`.
- [ ] **Step 3: Commit** — `git add src/newtab/App.tsx src/newtab/components/ScoreCards.tsx src/newtab/components/Timeline.tsx src/newtab/components/ScreenTimeDetails.tsx && git commit -m "feat(design): re-skin dashboard core to Fable"`

---

### Task 4: Dashboard panels A

**Files:** `src/newtab/components/ShortVideoReport.tsx`, `src/newtab/components/GoalsProgress.tsx`, `src/newtab/components/GoalManager.tsx`, `src/newtab/components/Achievements.tsx`

**Reference:** the "Short Video Report", "Goals Progress", and "Achievements" cards in the mockup.

Apply the Class Mapping. Specifics:
- `ShortVideoReport.tsx`: cream card; `font-display` title; count in `font-display` `text-[#b85c38]`; per-platform rows with track `rgba(54,43,26,.1)` and `#b85c38`/`#7c5a80`/`#58789f` fills; the trend note in a green-tint pill (`bg-[#eef0e0] border-[#4d7c57] text-[#2f5238]`).
- `GoalsProgress.tsx`: cream card; `font-display` title; goal rows with `text-ink-200` labels, status in the accent color, bars track `rgba(54,43,26,.1)` fill = accent (green when met, amber when partial).
- `GoalManager.tsx`: cream card + inputs/selects on `#fffdf5` with `1.5px rgba(54,43,26,.3)` borders; add/remove buttons per the button mapping (primary green / ghost); keep all form logic and text.
- `Achievements.tsx`: cream card; grid of circular badges — unlocked use a tinted bg + colored 1.5px border (rotate green/amber/blue tints), locked use `bg-[#f3ecd9] border-[1.5px] border-dashed rgba(54,43,26,.4)` + `filter:grayscale(1) opacity:.38`; labels `text-ink-200`/`text-ink-400`.

- [ ] **Step 1: Re-skin the four files** per the brief; preserve logic/props/text.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/newtab && npm run build`.
- [ ] **Step 3: Commit** — `git add src/newtab/components/ShortVideoReport.tsx src/newtab/components/GoalsProgress.tsx src/newtab/components/GoalManager.tsx src/newtab/components/Achievements.tsx && git commit -m "feat(design): re-skin dashboard panels A to Fable"`

---

### Task 5: Dashboard panels B

**Files:** `src/newtab/components/WeeklyReport.tsx`, `src/newtab/components/WeeklyInsight.tsx`, `src/newtab/components/Recommendations.tsx`, `src/newtab/components/DomainActivity.tsx`, `src/newtab/components/EyeCare.tsx`, `src/newtab/components/SleepNote.tsx`, `src/newtab/components/HealthTrends.tsx`

**Reference:** "Weekly Trend" + "For You Today" cards; extrapolate the same card style to the un-mocked panels (DomainActivity, EyeCare, SleepNote, HealthTrends).

Apply the Class Mapping. Specifics:
- `WeeklyReport.tsx`: cream card; `font-display` title; sparkline strokes use the Fable accents; per-metric rows `text-ink-200` + trend `text-[#2f5238]`/`text-ink-400`.
- `WeeklyInsight.tsx`, `Recommendations.tsx`: green-tint "For You Today" card (`bg-[#eef0e0] border-[#4d7c57]`) with inner recommendation cards on `#faf5e9` + `1.5px rgba(54,43,26,.2)`; emoji + `font-extrabold` `text-ink-100` heading + `text-ink-400` body. Keep the loading/no-key/private/error states (just repaint: skeletons on `rgba(54,43,26,.08)`).
- `DomainActivity.tsx`: cream card; ranked rows on `#fffdf5`; the domain monogram uses `CATEGORY_COLORS` tints; category chip in accent; bars track `rgba(54,43,26,.1)`; the "Show all" button ghost-pill.
- `EyeCare.tsx`: cream card; featured tip in a green-tint box (`bg-[#eef0e0] border-[#4d7c57]`); the rest as `#fffdf5` tiles; "Shuffle" ghost-pill; nudge text `text-ink-400`.
- `SleepNote.tsx`: cream `.wm-panel`; `font-display` heading; note `text-ink-400`; keep `text-health`/`text-shorts` accents (now Fable via tokens).
- `HealthTrends.tsx`: cream card; `font-display` heading; bar strips use green `#4d7c57` with today brighter; arrows green `#2f5238` (healthy) / amber `#c9892f` (unhealthy) / `text-ink-500` (flat) — update the hardcoded arrow hexes in `arrow()` accordingly; best/worst footer `text-ink-500`.

- [ ] **Step 1: Re-skin the seven files** per the brief; preserve logic/props/text.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/newtab && npm run build`.
- [ ] **Step 3: Commit** — `git add src/newtab/components/WeeklyReport.tsx src/newtab/components/WeeklyInsight.tsx src/newtab/components/Recommendations.tsx src/newtab/components/DomainActivity.tsx src/newtab/components/EyeCare.tsx src/newtab/components/SleepNote.tsx src/newtab/components/HealthTrends.tsx && git commit -m "feat(design): re-skin dashboard panels B to Fable"`

---

### Task 6: Settings

**Files:** `src/settings/App.tsx`, `src/settings/App.test.tsx` (only if a query breaks)

Apply the Class Mapping. Specifics:
- Page bg `#e9dfc9`; title in `font-display` `text-ink-100` (replace the blue→teal gradient text with solid `text-[#2f5238]`).
- Each `<section>`: cream card `bg-[#faf5e9] border-[2px] border-[#362b1a] rounded-[18px]` with an offset shadow, or `.wm-card`. Section headings `text-ink-300 font-extrabold` (or `font-display`).
- Inputs/selects: `bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] text-ink-100`; focus ring green.
- Checkboxes: `accent-[#2f5238]`. Segmented buttons (frequency, break/nudge intervals, personalities): selected = `bg-[#2f5238] text-[#f3ecd9]`, unselected = `bg-[#f3ecd9] text-ink-300 border-[1.5px] border-[rgba(54,43,26,.22)]`.
- Save button + "Add" domain button → primary green pill; "Clear Data" → red-tint (`bg-[#f4e7e0] border-[1.5px] border-[#b85c38] text-[#8a4326]`); Export → ghost pill.
- **Theme section:** replace the `light/dark/system` buttons with a single static row: a label "Appearance" and a read-only chip "Fable" (`bg-[#f3ecd9] border-[1.5px] border-[rgba(54,43,26,.25)] text-ink-300`). Remove the `updateSettings({ theme })` handlers. Keep the `settings.theme` field in state untouched (no type change). If `src/settings/App.test.tsx` asserts theme buttons, update that test to the new static chip; otherwise leave tests unchanged. Do NOT weaken any other assertion.
- The clear-data confirmation dialog: cream card, brown border, buttons per mapping.

- [ ] **Step 1: Re-skin `settings/App.tsx`** per the brief; preserve all form logic, labels, and handlers (except the theme buttons as noted).
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/settings && npm run build`. If a settings test fails only due to the removed theme buttons, update just that test's query to the static chip (assertion strictness unchanged); any other failure → STOP and report.
- [ ] **Step 3: Commit** — `git add src/settings && git commit -m "feat(design): re-skin settings to Fable"`

---

### Task 7: Side panel

**Files:** `src/sidepanel/App.tsx`, `src/sidepanel/components/ChatThread.tsx`, `src/sidepanel/components/QuickPrompts.tsx`

**Reference:** the "Side Panel · AI Coach" screen in the mockup.

Apply the Class Mapping. Specifics:
- Root: cream `#faf5e9`, `text-ink-100`, `font-sans`.
- Context bar: `#f3ecd9` with a bottom brown hairline; green coach avatar badge; name in `font-display`; subtitle `text-ink-500`.
- `ChatThread.tsx`: assistant bubbles `bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)]` with asymmetric radius (`rounded-[4px_16px_16px_16px]`), text `text-ink-200`; user bubbles `bg-[#2f5238] text-[#f3ecd9]` `rounded-[16px_4px_16px_16px]`; typing dots use `wm-anim-pulse` on `#a3947a`. Preserve message mapping/keys.
- `QuickPrompts.tsx`: ghost pill chips (`border-[1.5px] border-[rgba(54,43,26,.3)] text-ink-300`).
- Input row: `bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.35)] rounded-[22px]`; placeholder `text-ink-500 italic`; send button a green circle with `#f3ecd9` arrow. Keep all handlers.

- [ ] **Step 1: Re-skin the three files** per the brief; preserve logic/props/text.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/sidepanel && npm run build`.
- [ ] **Step 3: Commit** — `git add src/sidepanel && git commit -m "feat(design): re-skin side panel to Fable"`

---

### Task 8: Breathe page

**Files:** `src/breathe/App.tsx`

Apply the Class Mapping. Specifics:
- Page bg `#e9dfc9` (replace `bg-navy-950`), `text-ink-100`.
- The breathing circle: replace `wm-brand-grad` with a green fill (`background:#2f5238`, or a subtle `linear-gradient(#4d7c57,#2f5238)`), keep the `scale` transform and box-shadow (tune shadow to `rgba(47,82,56,.4)`).
- Phase label in `font-display`; "Cycle N of 4" and "carry the calm…" in `text-ink-500`.
- "Done" button → secondary ghost pill (`border-[1.5px] border-[rgba(54,43,26,.35)] text-ink-300`).
- Keep the `breathing.ts` logic, timer, Esc handler, and `chrome.tabs` close untouched.

- [ ] **Step 1: Re-skin `breathe/App.tsx`**; preserve logic/text. The breathe `App.test.tsx` asserts "Breathe in" / "Cycle 1 of 4" / a Done button — keep those exact strings.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run src/breathe && npm run build`.
- [ ] **Step 3: Commit** — `git add src/breathe/App.tsx && git commit -m "feat(design): re-skin breathe page to Fable"`

---

### Task 9: Content-script overlays

**Files:** `src/content/mindfulOverlay.ts`

**Reference:** the "Mindful Check-in" overlay in the mockup.

`mindfulOverlay.ts` renders four Shadow-DOM cards via inline `OVERLAY_STYLES` + inline markup: the mood check-in (`createOverlay`), the break card (`createBreakOverlay`), the wind-down card (`createWindDownOverlay`), and the nudge toast (`showNudgeToast` / `NUDGE_STYLES`). Repaint all of them to the Fable card — **inline styles only, no imports, stay dependency-free** (the `check:worker` guard and content-script purity must hold; `mindfulOverlay.js` must stay import-free).

Repaint rules (edit the `OVERLAY_STYLES` / `NUDGE_STYLES` strings and any inline `style="…"` in the builders):
- Card: `background:#faf5e9; border:2px solid #362b1a; border-radius:18px; box-shadow:6px 8px 0 rgba(54,43,26,.35); color:#362b1a;`.
- Font: `font-family:'Alegreya Sans', system-ui, sans-serif;` (Shadow DOM can't use page fonts reliably — system fallback is fine); titles may use `'Young Serif', serif` and will fall back gracefully.
- Title eyebrow `color:#2f5238; font-weight:800;`; message `color:#463a25`.
- Mood chips: default `background:#fffdf5; border:1.5px solid rgba(54,43,26,.25); color:#5d5138`; the selected/emphasis chips use tinted borders (green `#eef0e0`/`#4d7c57`, red `#f4e7e0`/`#b85c38`) per the mockup.
- Buttons: primary `background:#2f5238; color:#f3ecd9; border:1.5px solid #2f5238;` (pill); secondary `background:transparent; border:1.5px solid rgba(54,43,26,.35); color:#5d5138;`; close "✕" `color:#7a6a4f`.
- Nudge toast: `background:#faf5e9; border:1.5px solid #362b1a; color:#463a25; box-shadow:4px 5px 0 rgba(54,43,26,.25);` (keep `pointer-events:none`, fade in/out, auto-dismiss).
- `windDownTint.ts` is unchanged (its warm amber tint keeps its function).

- [ ] **Step 1: Repaint the overlay/toast inline styles** per the rules; preserve all markup structure, message types, button `data-action`s, and response messaging.
- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx vitest run && npm run build`. Confirm `dist/mindfulOverlay.js` has no top-level `import` and `check:worker` passes.
- [ ] **Step 3: Commit** — `git add src/content/mindfulOverlay.ts && git commit -m "feat(design): re-skin content overlays to Fable"`

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1:** `npx vitest run` — all suites pass.
- [ ] **Step 2:** `npx tsc --noEmit` — no errors.
- [ ] **Step 3:** `npm run build` — succeeds; `check:worker` prints OK; content scripts import-free.
- [ ] **Step 4: Manual smoke (load unpacked).** Reload `dist/`, and check each surface against `docs/design/WiseMind-AI-Fable.html`: popup, dashboard (all panels), settings, side panel, breathe page, and the overlays (trigger a break/wind-down/nudge, or verify via the mockup) — warm paper palette, Young-Serif headings, green brand, hard offset shadows, no leftover dark-navy/slate surfaces.
- [ ] **Step 5:** Commit any final tweak — `git add -A && git commit -m "chore(design): finalize Fable re-skin"`.

---

## Self-Review

- **Spec coverage:** foundation tokens/fonts/helpers + category colors (Task 1) ✓; popup (2) ✓; dashboard core (3) + panels A (4) + panels B incl. newer panels (5) ✓; settings incl. Theme→static chip (6) ✓; side panel (7) ✓; breathe (8) ✓; content overlays incl. all 4 cards + toast (9) ✓; every surface from the spec inventory has a task; visual-only + worker-guard gate in Global Constraints ✓; category remap (Task 1) ✓.
- **Placeholder scan:** Task 1 is exact/complete code. Tasks 2–9 are deliberately translation briefs (design reproduction, not transcription) — each names files, the mockup region, the shared Class Mapping, and concrete per-file hexes/classes; acceptance is build+tests+worker-guard+visual match. This is the correct form for a re-skin; the authoritative pixel target is `docs/design/WiseMind-AI-Fable.html`.
- **Consistency:** token names retargeted once in Task 1 and relied on everywhere; the Class Mapping is defined once (Global Constraints) and referenced by every surface task; `CATEGORY_COLORS` keys unchanged (14) so no consumer breaks; no logic/prop/text/message changes anywhere.
