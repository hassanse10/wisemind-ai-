# WiseMind AI — Chrome Extension Design Spec
**Date:** 2026-06-27  
**Status:** Approved

---

## Overview

WiseMind AI is a premium Google Chrome extension that acts as an intelligent digital wellness coach. It tracks browsing behavior, classifies activity using AI, detects short-video consumption, generates personalized health/productivity/learning scores, and delivers context-aware coaching guidance — all locally, with no backend required.

**Core philosophy:** Guide rather than control. Never shame. Act like a wise mentor, not a parental blocker.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Modular event-driven (Approach B) | Scalable to 22+ features; each engine independently testable |
| AI provider | OpenRouter API | User brings own key; access to GPT-4o-mini and other models |
| Default model | `openai/gpt-4o-mini` | Low cost (~$0.01/day typical usage), strong classification quality |
| API key storage | `chrome.storage.local` | Fully on-device, never leaves the browser |
| Data storage | IndexedDB + chrome.storage.local | IndexedDB for history; storage.local for settings + cached scores |
| UI surfaces | Popup + New Tab + Side Panel | Full three-surface experience |
| Onboarding | Silent start | Tracking begins immediately; user discovers features organically |
| Backend | None | Pure client-side; only network calls are OpenRouter API requests |

---

## Architecture

### Build Setup

- **Bundler:** Vite with multiple entry points
- **Language:** TypeScript throughout
- **UI:** React + Tailwind CSS with custom design tokens (blues/greens palette)
- **Themes:** Dark / Light / System

### Project Structure

```
wisemind-ai/
├── src/
│   ├── background/
│   │   ├── index.ts                 # Service worker entry — wires engines to Chrome events
│   │   ├── TrackingEngine.ts
│   │   ├── ClassifierEngine.ts
│   │   ├── CoachingEngine.ts
│   │   ├── ScoringEngine.ts
│   │   ├── NotificationManager.ts
│   │   └── StorageManager.ts
│   ├── content/
│   │   ├── shortVideoDetector.ts    # Shorts/Reels/TikTok counter
│   │   ├── activityMonitor.ts       # Scroll speed, focus, video titles
│   │   └── mindfulOverlay.ts        # Shadow DOM check-in cards
│   ├── popup/                       # React app — quick stats widget
│   ├── newtab/                      # React app — full dashboard
│   ├── sidepanel/                   # React app — AI coach + conversation
│   ├── shared/
│   │   ├── types.ts
│   │   ├── db.ts                    # IndexedDB schema + access layer
│   │   ├── messaging.ts             # Type-safe chrome.runtime message protocol
│   │   └── hooks/                   # useStorage, useScores, useCoach, etc.
│   └── assets/
├── public/
│   ├── manifest.json
│   └── icons/
└── vite.config.ts                   # Multi-entry build config
```

### Communication Protocol

All inter-component communication uses a typed message bus on `chrome.runtime`. UI surfaces never write to storage directly — they send messages to the service worker which owns all writes.

```ts
// Discriminated union message types
{ type: "SITE_VISITED";      payload: { url, title, timestamp } }
{ type: "SHORT_WATCHED";     payload: { platform, count, duration } }
{ type: "ACTIVITY_SIGNAL";   payload: { scrollIntensity, videoPlaying, hasFocus, timestamp } }
{ type: "REQUEST_COACHING";  payload: { context } }
{ type: "SCORE_UPDATE";      payload: { health, productivity, learning } }
{ type: "SHOW_MINDFUL_CHECKIN"; payload: { message, stats, options } }
{ type: "COACHING_RESPONSE"; payload: { response, mood } }
```

### Chrome APIs

| API | Purpose |
|-----|---------|
| `chrome.tabs` | Active tab tracking, URL changes |
| `chrome.webNavigation` | Page load events, navigation, YouTube pushState |
| `chrome.storage.local` | Settings, API key, daily summaries |
| `chrome.alarms` | Eye health reminders, 5-min coaching evaluation tick |
| `chrome.notifications` | System-level alerts when browser is in background |
| `chrome.sidePanel` | Side panel registration |
| `chrome.scripting` | Dynamic content script injection |
| `chrome.idle` | Detect when user steps away |

---

## Data Model

### IndexedDB — `wisemind_db`

**`visits`**
```ts
{
  id: string,
  url: string,
  domain: string,
  title: string,
  startTime: number,       // epoch ms
  endTime: number,
  duration: number,        // seconds
  category: Category,
  aiCategory: string,      // e.g. "programming tutorial", "sports highlights"
  classified: boolean
}
```

**`shortVideos`**
```ts
{
  id: string,
  platform: "youtube_shorts" | "instagram_reels" | "tiktok" | "facebook_reels",
  startTime: number,
  endTime: number,
  count: number,
  duration: number
}
```

**`coachingEvents`**
```ts
{
  id: string,
  timestamp: number,
  type: "mindful_checkin" | "health_tip" | "motivation" | "goal_reminder",
  message: string,
  userResponse: "continue" | "take_break" | "dismissed" | null,
  mood: "energized" | "fine" | "tired" | "just_scrolling" | null
}
```

**`dailySummaries`** — generated at 00:01 daily by a `chrome.alarms` alarm; `StorageManager` reads that day's `visits` + `shortVideos` and writes the entry. Also recomputed on-demand for the weekly report view.
```ts
{
  date: string,            // "2026-06-27"
  totalTime: number,
  byCategory: Record<Category, number>,
  shortVideoCount: number,
  shortVideoDuration: number,
  healthScore: number,
  productivityScore: number,
  learningScore: number,
  breaks: number,
  lateNightMinutes: number,
  topSites: Array<{ domain: string, duration: number }>
}
```

**`goals`**
```ts
{
  id: string,
  type: "reduce" | "increase",
  target: Category | "shorts" | "sleep",
  dailyLimitMinutes: number | null,
  weeklyTargetMinutes: number | null,
  createdAt: number,
  active: boolean
}
```

### `chrome.storage.local`

```ts
{
  openrouterApiKey: string,
  selectedModel: string,             // default: "openai/gpt-4o-mini"
  mentorPersonality: "wise" | "friendly" | "coach" | "mindful" | "funny",
  theme: "dark" | "light" | "system",
  coachingEnabled: boolean,
  coachingFrequency: "gentle" | "moderate" | "assertive",
  coachingHours: { start: number, end: number },  // e.g. { start: 9, end: 22 }
  excludedDomains: string[],
  privateModeActive: boolean,
  eyeHealthReminders: boolean,
  lastHealthScore: number,
  todaysSummary: DailySummary,       // cached for popup instant read
  achievements: Array<{ id, unlockedAt, seen }>,
  ruleLastFired: Record<string, number>   // cooldown tracking per rule
}
```

### Website Categories

```ts
type Category =
  | "learning" | "programming" | "productivity" | "ai_tools" | "reading"
  | "entertainment" | "gaming" | "social_media" | "news" | "shopping"
  | "finance" | "health" | "communication" | "other"
```

---

## Engine Specifications

### TrackingEngine

Maintains an active session per tab in memory. Session ends on tab switch, close, or 60-second idle.

- Sessions under 5 seconds are discarded
- Private mode / excluded domains are skipped entirely
- On service worker restart: recovers by querying `chrome.tabs` for current active tab
- Writes completed `Visit` records to IndexedDB, queues them for classification

**Event hooks:**
- `chrome.tabs.onActivated` → switch active session
- `chrome.webNavigation.onCompleted` → new URL = new session
- `chrome.idle.onStateChanged` → pause/resume on idle
- `chrome.windows.onFocusChanged` → pause when browser loses focus

---

### ClassifierEngine

Two-tier classification pipeline:

**Tier 1 — Local domain map (instant, no API call):**
~200 known domains pre-mapped to categories. Visits to known domains are classified immediately with `classified: true`.

**Tier 2 — AI classification (ambiguous sites + YouTube/Reddit/Medium):**
Unclassified visits are batched (up to 10) and sent to OpenRouter in a single request. Response updates `category` and `aiCategory` on each visit record.

Prompt pattern:
```
System: You are a website activity classifier. Classify each browsing session.
Return JSON array: [{ id, category, aiCategory, confidence }]
Possible categories: [list of Category values]

User: [{ id, url, title }, ...]
```

---

### CoachingEngine

Runs on a `chrome.alarms` tick every 5 minutes. Evaluates behavioral context against priority-ordered rules. Respects per-rule cooldowns tracked in `chrome.storage.local`.

**Gate checks at start of every tick:**
1. `coachingEnabled` must be `true`
2. Current hour must be within `coachingHours.start`–`coachingHours.end`
3. `privateModeActive` must be `false`

If any gate fails, the tick exits immediately with no rule evaluation.

**Context snapshot assembled at each tick:**
```ts
{
  continuousMinutes: number,
  currentCategory: Category,
  shortVideoCount: number,
  shortVideoMinutes: number,
  lateNight: boolean,
  lastBreakMinutes: number,
  todayHealthScore: number,
  goals: Goal[],
  recentMood: string | null,
  mentorPersonality: Personality
}
```

**Coaching rules (priority order):**

| Priority | Condition | Type | Cooldown |
|----------|-----------|------|----------|
| 1 | Late night + screen on > 20 min | Sleep coach | 30 min |
| 2 | Shorts count > 50 in session | Mindful check-in | 30 min |
| 3 | Continuous browsing > 90 min | Break reminder | 45 min |
| 4 | Entertainment > 2h + has learning goal | Goal nudge | 60 min |
| 5 | Focus session > 45 min (learning/programming) | Encouragement | 60 min |
| 6 | Every 20 min on screen | Eye health (20-20-20) | 20 min |

**AI message generation prompt:**
```
System: You are a {personality} digital wellness coach inside a Chrome extension.
Be concise (2-3 sentences max). Never shame the user.
Tone: {personality tone description}

User: Context: {JSON snapshot}. Rule triggered: {rule type}.
Generate a coaching message.
```

**Habit detection** — after 7 days of data, analyzes `dailySummaries` to detect recurring patterns and suppress irrelevant rule firings during expected windows.

---

### ScoringEngine

Recomputes all three scores every 5 minutes. Writes results to `todaysSummary` in `chrome.storage.local`.

**Health Score (0–100, five dimensions × 20 pts each):**

A **break** is defined as `chrome.idle` reporting the user idle for ≥5 consecutive minutes during active browsing hours (06:00–23:00). Each qualifying idle period increments the day's break counter.

| Dimension | Full score | Deductions |
|-----------|-----------|------------|
| Sleep | No browsing 23:00–06:00 | −2 per 10 min late-night use |
| Learning | ≥30 min learning today | Scales proportionally below 30 min |
| Entertainment | ≤2h entertainment | −3 per 30 min over |
| Breaks | ≥3 breaks today | −5 per missed break |
| Eye Health | Responded to all reminders | −4 per dismissed reminder |

**Productivity Score (0–100):**
```
base = (productiveMinutes / totalMinutes) * 100
+ bonus: +10 if focus sessions > 2 (unbroken 25+ min blocks)
- penalty: −15 if tab switch rate > 20/hour
- penalty: −10 if shortVideoCount > 30
```
Productive categories: `programming`, `learning`, `productivity`, `ai_tools`, `reading`, `communication`

**Learning Score (0–100):**
```
base = min(learningMinutes / 60, 1) * 70    // up to 70 pts for 60 min
+ videoBonus: +15 if educational video minutes > 20
+ streakBonus: +15 if 7-day learning streak active
```

---

### NotificationManager

Routes coaching messages to the appropriate delivery surface:

| Scenario | Delivery |
|----------|----------|
| User actively on a page | MindfulOverlay (Shadow DOM card) |
| Browser open, new tab active | Side panel ping + badge dot |
| Browser in background | `chrome.notifications` system alert |
| Eye health reminder | Side panel non-blocking toast |

---

## Content Scripts

### shortVideoDetector.ts

Injected into YouTube, TikTok, Instagram, Facebook. Uses `MutationObserver` + `chrome.webNavigation.onHistoryStateUpdated` to detect each new short video.

- **YouTube Shorts:** `/shorts/` URL pattern + pushState navigation events
- **TikTok:** Observes video container mutations; each new video element = +1
- **Instagram Reels:** `/reels/` URL pattern + scroll container observation
- **Facebook Reels:** Reel container observation

Each new video fires:
```ts
{ type: "SHORT_WATCHED", payload: { platform, videoId, title, timestamp } }
```

### activityMonitor.ts

Injected into all pages. Sends behavioral signals every 30 seconds:
- Scroll speed (from `wheel` event delta)
- Tab focus (`visibilitychange`)
- Video playing state (`<video>` element events)
- Page title + `og:title` for AI classification context
- Late-night flag (hour ≥ 23 or ≤ 6)

### mindfulOverlay.ts

Renders floating check-in cards via Shadow DOM (style-isolated from host page). Triggered by `SHOW_MINDFUL_CHECKIN` message. Card includes:
- AI-generated coaching message
- Behavioral stats (e.g., "127 Shorts in 52 minutes")
- Mood selection: 😊 Energized / 😐 Fine / 😴 Tired / 😵 Just scrolling
- Action buttons: Continue / Take a Break / Watch Learning Content

---

## UI Surfaces

### Popup (400×580px)

Top-to-bottom layout:
1. Header: Logo + date + settings icon
2. Health Score ring (animated, large) + Productivity / Learning pills
3. Today's screen time bar — color-coded by category
4. Short video counter card (shown if count > 0): "47 Shorts today"
5. Active coaching message card with action buttons (if pending)
6. Quick links: Open Dashboard / Open Coach / Goals

### New Tab Dashboard

Full-width React SPA replacing the default new tab:

- **Hero:** AI-generated daily inspirational message + date
- **Score Cards Row:** Health / Productivity / Learning rings with star sub-breakdowns
- **Today's Timeline:** Horizontal hour-by-hour bar, color-coded, hover shows site + duration
- **Screen Time Breakdown:** Donut chart by category + ranked site list
- **Short Video Report:** Platform breakdown (count + duration per platform)
- **Goals Progress:** Card per active goal with progress bar
- **Achievements:** Unlocked badges + greyed upcoming badges
- **Weekly Trend:** Sparkline charts — Learning / Entertainment / Productivity over 7 days
- **Recommendations:** 3 AI-generated action cards for the day

### Side Panel — AI Coach

- Top context bar: Mentor avatar + name + current behavior summary
- Scrollable conversation thread (markdown-rendered, right-aligned user messages)
- Quick prompt chips: "How am I doing today?" / "Am I improving?" / "Give me a tip"
- Text input: "Ask your coach anything..."
- Bottom tabs: Chat / Stats (compact scores) / Goals (active goals with toggles)

---

## Gamification

Achievements evaluated at end-of-day during `dailySummaries` generation:

| Achievement | Condition |
|-------------|-----------|
| Deep Learner | Learning score ≥ 90 for a day |
| Seven-day Focus | Productivity score ≥ 75 for 7 consecutive days |
| Healthy Week | Health score ≥ 80 every day for 7 days |
| Eye Care Champion | Responded to all eye-health reminders for 3 days |
| Balanced Day | All three scores ≥ 70 on same day |
| Digital Minimalist | Entertainment < 30 min for 5 consecutive days |
| Learning Streak | Any learning content every day for 7 days |

New achievement unlocks trigger a side panel toast notification.

---

## AI Mentor Personalities

| Personality | Tone | Behaviour |
|-------------|------|-----------|
| Wise Mentor | Calm, thoughtful | Like an experienced teacher; reflective questions |
| Friendly Friend | Relaxed, positive | Encouraging, casual language |
| Tough Coach | Disciplined | Challenges excuses, motivates action |
| Mindfulness Guide | Peaceful | Breathing focus, stress reduction |
| Funny Companion | Playful | Humorous reminders, light jokes |

Personality is passed to every AI prompt. Default: Wise Mentor.

---

## Weekly Reports

Generated on-demand from last 7 `dailySummaries`:

- Learning time: this week vs. last (% change + trend arrow)
- Entertainment time: this week vs. last
- Productivity average trend
- Short video count: this week vs. last
- Late-night browsing per day
- Longest focus session of the week
- Best day (highest health score)
- Weekly achievement highlights
- **AI Weekly Insight:** One OpenRouter call generates a 3-sentence personalized weekly reflection based on aggregated data + user goals

---

## Privacy & Settings

**Settings page** (opens as full tab from popup gear icon):

- **API Configuration:** OpenRouter key input (masked) + model selector + connection test
- **Mentor Personality:** Five card options with tone preview
- **Coaching Controls:** Enable/disable, frequency (gentle/moderate/assertive), active hours
- **Excluded Sites:** Domain blocklist — skipped from tracking entirely
- **Private Mode:** One-click toggle — pauses all tracking, no data written
- **Theme:** Light / Dark / System
- **Data Management:** Export JSON / Delete today / Delete all history / Storage usage

**Privacy guarantees:**
- All data stored on-device only (chrome.storage.local + IndexedDB)
- Only data sent to external services: page titles + URLs to OpenRouter for classification (no page content, no personal data)
- OpenRouter API key never leaves the browser
- Private mode completely pauses all tracking and AI calls

---

## Manifest V3 Permissions

```json
{
  "permissions": [
    "tabs", "storage", "alarms", "notifications",
    "sidePanel", "scripting", "idle", "webNavigation"
  ],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    { "matches": ["<all_urls>"], "js": ["activityMonitor.js"] },
    { "matches": ["*://*.youtube.com/*", "*://*.tiktok.com/*",
                   "*://*.instagram.com/*", "*://*.facebook.com/*"],
      "js": ["shortVideoDetector.js"] }
  ]
}
```

---

## Out of Scope (v1)

- Cloud sync (Firebase/Supabase) — local-only for v1
- Mobile / cross-browser support
- Social features / shared goals
- Custom rule builder (user-defined coaching rules)
- Screen recording or screenshot analysis
- Browser history import (only tracks from install date forward)
