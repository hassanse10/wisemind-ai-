# WiseMind AI — "Fable" Re-skin Design

**Date:** 2026-07-01
**Status:** Approved (pending spec review)
**Source design:** `docs/design/WiseMind-AI-Fable.html` (imported from the claude.ai design project "WiseMind AI extension design", file `WiseMind AI Fable.dc.html`). That file is the visual source of truth; this spec distills its design system and maps it onto the codebase.

## Goal

Fully replace the current dark-navy theme with the warm-paper "Fable" theme across **every** surface — popup, new-tab dashboard (all panels), settings, side panel, breathe page, and the content-script overlays (mindful check-in, break, wind-down, nudge toast). Visual-only re-skin: no behavior, data, engine, or messaging changes.

## Decisions (from scoping)

- **Fully replace** the dark theme (single Fable look; the Settings "Theme" dropdown becomes cosmetic — leave it but it has no visual effect, or hide it; see Settings section).
- **All surfaces**, including the ones not in the mockup (extrapolate the same design language to Settings, Breathe, the wind-down/nudge overlays, and the newer dashboard panels: Screen Time Details, Domain Activity, Eye Care, Sleep note, Health Trends).
- **Remap `CATEGORY_COLORS`** to the Fable palette so charts/legends match.

## Design system

### Fonts
- Display / headings: **Young Serif** (`'Young Serif', serif`).
- Body / UI: **Alegreya Sans** (`'Alegreya Sans', sans-serif`), weights 400/500/700/800.
- Google Fonts import (replaces the current Manrope/Space Grotesk import):
  `https://fonts.googleapis.com/css2?family=Young+Serif&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap`

### Palette (exact hex)
- **Surfaces:** page `#e9dfc9`; primary card `#faf5e9`; inner/lighter card `#fffdf5`; tan panel `#f3ecd9`.
- **Ink (text):** strongest `#362b1a`; body `#463a25`; muted `#5d5138`; soft `#7a6a4f`; faint `#8a7a5c`; faintest `#a3947a`.
- **Brand green:** deep `#2f5238`; medium `#4d7c57`.
- **Category / score accents:** health/reading green `#4d7c57`; productivity/work blue `#58789f`; learning/amber `#c9892f` (dark-amber text `#96650f`); social/purple `#7c5a80`; shorts/warning red-orange `#b85c38` (dark `#8a4326`).
- **Accent tint panels:** green `#eef0e0` (border `#4d7c57`); blue `#e8edf2` (border `#58789f`); amber `#f6ead2` (border `#c9892f`); red `#f4e7e0` (border `#b85c38`).
- **Hairlines:** `rgba(54,43,26,.1 / .18 / .22 / .25 / .3)` depending on emphasis.

### Motifs
- Outer cards/pages: `background:#faf5e9; border:2px solid #362b1a; border-radius:18–22px; box-shadow:6px 8px 0 rgba(54,43,26,.18)` (neobrutalist hard offset shadow).
- Inner cards: `background:#fffdf5 or #f3ecd9; border:1.5px solid rgba(54,43,26,.25); border-radius:13–18px` (no shadow, or a lighter one).
- Category cards use the tint-panel background + matching colored 1.5px border.
- Buttons: pill (`border-radius:20–24px`). Primary = `#2f5238` fill, `#f3ecd9` text, `1.5px solid #2f5238`. Secondary = transparent, `1.5px solid rgba(54,43,26,.35)`, `#5d5138` text.
- Score ring: track `#f3ecd9` / `rgba(54,43,26,.15–.18)`, progress in the score's accent color, number in Young Serif.
- Logo: round green (`#2f5238`) badge, `2px solid #362b1a`, containing the leaf/sprout SVG (`M12 21V9 / M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z / M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z`, stroke `#f3ecd9`).
- Section/card titles: Young Serif, ~16px. Eyebrow labels: Alegreya Sans 800, uppercase, letter-spacing ~.09em, color `#8a7a5c`.
- Keep the existing `wmpulse` / `wmfloat` keyframes (already present).

## Component 1: Theme foundation (`src/shared/index.css`)

Rewrite the `@theme` block and helpers:
- Swap the font `@import` to Young Serif + Alegreya Sans; set `--font-sans: 'Alegreya Sans', …` and `--font-display: 'Young Serif', …`.
- Redefine the color tokens to the paper palette. Keep the SAME token NAMES the components already use so token-based usages flip automatically, mapping by role (not by literal name):
  - `--color-navy-950/900/850/800` → paper surfaces (`#e9dfc9` page, `#faf5e9`/`#fffdf5`/`#f3ecd9` cards). (Names stay "navy-*" but now hold paper values.)
  - `--color-ink-100…700` → brown ink scale (`#362b1a` … `#a3947a`), i.e. inverted lightness so `text-ink-100` is now the strongest dark-brown.
  - `--color-health` `#4d7c57`, `--color-prod` `#58789f`, `--color-learn` `#c9892f`, `--color-social` `#7c5a80`, `--color-shorts` `#b85c38`, `--color-reading` `#4d7c57`, `--color-cyan`/others mapped sensibly.
  - Add tokens for the tint panels + brand green if helpful (`--color-brand-green: #2f5238`, `--color-paper-*`).
- Rewrite helpers: `.wm-card` (cream, 2px brown border, offset shadow), `.wm-panel` (inner `#fffdf5`, 1.5px hairline border), `.wm-brand-grad` → a solid green badge style (`#2f5238`) since the design uses solid green not a gradient (rename kept for compatibility; make it render green). Set `body { background:#e9dfc9 }`.

This single change re-themes all *token-based* usages. Components using hardcoded dark utilities (`bg-slate-*`, `bg-white/[0.0x]`, `text-slate-*`, `bg-blue-*`) still need per-file edits (below).

## Component 2: Category colors (`src/shared/constants.ts`)

Remap `CATEGORY_COLORS` to the Fable palette: learning `#c9892f`, programming `#58789f`, productivity `#58789f`, ai_tools `#4d7c57`, reading `#4d7c57`, entertainment `#7c5a80`, gaming `#b85c38`, social_media `#7c5a80`, news `#8a7a5c`, shopping `#c9892f`, finance `#4d7c57`, health `#4d7c57`, communication `#58789f`, other `rgba(54,43,26,.3)` → use a hex `#a3947a`. (Exact assignments finalized in the plan; keep all 14 keys.) `CATEGORY_LABELS` unchanged.

## Component 3: Surfaces (per-file re-skin to the Fable look)

Each file's dark classes/inline styles are translated to the paper palette + motifs above, matching the corresponding mockup region in `docs/design/WiseMind-AI-Fable.html`. Grouped for implementation:

- **Popup** — `src/popup/App.tsx`, `components/ScoreRing.tsx`, `components/ScreenTimeBar.tsx`, `components/CoachingCard.tsx`. Match the "Popup" mockup: cream card, round green logo, Health ring + Productivity/Learning pills, screen-time bar + legend, coaching card (green-tinted, "SAGE · WISE MENTOR"), 3 pill quick-links.
- **Dashboard core** — `src/newtab/App.tsx`, `components/ScoreCards.tsx`, `components/Timeline.tsx`, `components/ScreenTimeDetails.tsx`. Match the dashboard top bar (streak chip, date), Young-Serif hero line with amber underline, 3 category-tinted score cards with rings + ✦ ratings, timeline bar + legend.
- **Dashboard panels A** — `components/ShortVideoReport.tsx`, `components/GoalsProgress.tsx`, `components/GoalManager.tsx`, `components/Achievements.tsx`. Short-video report (red-orange), goals progress bars, achievements grid (circular tinted badges, locked = dashed grayscale).
- **Dashboard panels B** — `components/WeeklyReport.tsx`, `components/WeeklyInsight.tsx`, `components/Recommendations.tsx`, `components/DomainActivity.tsx`, `components/ScreenTimeBar.tsx` (if shared), `components/EyeCare.tsx`, `components/SleepNote.tsx`, `components/HealthTrends.tsx`. Weekly trend sparklines, "For You Today" recommendation cards (green-tint), and the newer panels extrapolated to cream cards + accent bars.
- **Settings** — `src/settings/App.tsx`. Paper page, cream section cards with 2px borders, pill toggles/segmented buttons in the green/tan style, inputs on `#fffdf5`. The "Theme" section becomes cosmetic — keep the control but note it no longer switches (or replace with a short "Appearance: Fable" note).
- **Side panel** — `src/sidepanel/App.tsx`, `components/ChatThread.tsx`, `components/QuickPrompts.tsx`. Match the "Side Panel" mockup: context bar (Sage, focus time), chat bubbles (assistant = `#fffdf5` with brown hairline + asymmetric radius; user = green `#2f5238` with `#f3ecd9` text), quick chips, pill input with green send button. (Bottom tab bar in the mockup is optional — only if trivial; otherwise keep current structure re-skinned.)
- **Breathe** — `src/breathe/App.tsx`. Paper background; the circle uses the green brand fill (`#2f5238`→`#4d7c57`) instead of the old gradient; Young-Serif phase label; secondary pill "Done" button.
- **Content overlays** — `src/content/mindfulOverlay.ts` (mood check-in, break card, wind-down card, nudge toast) and `src/content/windDownTint.ts`. These use inline `OVERLAY_STYLES` / inline styles (Shadow DOM, must stay dependency-free). Repaint them to the paper palette per the "Mindful Check-in" mockup (cream card, 2px brown border, `6px 8px 0` shadow, green primary buttons, mood chips with tinted borders). The wind-down warm tint keeps its function; its color can stay amber. Fonts inside Shadow DOM: use `'Alegreya Sans', system-ui, sans-serif` with a `@import`/font stack fallback (system-ui acceptable since Shadow DOM can't rely on page fonts — the mockup's serif titles may fall back to a serif stack; acceptable).

## Testing

- The suite is behavioral (labels, values, wiring) — a re-skin should not break it. Run `npx vitest run` after each surface; fix any test that asserts an old literal color/class (none are expected, but check).
- `npx tsc --noEmit`, `npm run build`, and the **`npm run check:worker`** guard must all pass after every task.
- No new unit tests (visual change); verify each surface against the mockup manually.

## Out of scope

Behavior, engines, data model, messaging, and copy remain unchanged. The `.dc.html`'s Vue-style `{{ }}` placeholders and the coach "Sage / tone" copy are design mock data — do not wire them; keep the app's existing dynamic content.

## Risk / rollback

Large multi-file visual change; each surface is an independent, revertable commit. Token-based components flip via `index.css`; hardcoded-class components are edited per file. If a surface looks wrong, it can be redone without affecting others.
