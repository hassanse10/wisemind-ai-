# WiseMind AI Chrome Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WiseMind AI — a Manifest V3 Chrome extension that tracks browsing behavior, classifies activity via OpenRouter AI, detects short-video consumption, computes health/productivity/learning scores, and delivers personalized coaching through popup, new tab, and side panel surfaces.

**Architecture:** Modular event-driven — a lean service worker wires five focused engines (TrackingEngine, ClassifierEngine, CoachingEngine, ScoringEngine, NotificationManager) communicating via a typed chrome.runtime message bus. Three React apps (popup, new tab, side panel) read from shared IndexedDB + chrome.storage.local. Content scripts handle in-page detection and overlay rendering via Shadow DOM.

**Tech Stack:** Manifest V3, TypeScript 5, React 18, Tailwind CSS 3, Vite 5, Vitest 2, @testing-library/react 16, jsdom, idb 8, uuid 10, clsx 2.

## Global Constraints

- Manifest V3 only — no background pages, no remote code execution
- All data on-device only — chrome.storage.local + IndexedDB, nothing server-side
- OpenRouter API key stored in chrome.storage.local only; default model: `openai/gpt-4o-mini`
- Sessions under 5 seconds are discarded from tracking
- Private mode and excluded domains skip all tracking and AI calls entirely
- CoachingEngine gate at every tick: check `coachingEnabled`, `coachingHours`, `privateModeActive` — exit immediately if any gate fails
- A break = chrome.idle idle state for ≥5 consecutive minutes during 06:00–23:00
- Content scripts use Shadow DOM for all overlays (Tailwind styles injected into shadow root)
- Vite multi-entry build: separate bundles for background, popup, newtab, sidepanel, settings, activityMonitor, shortVideoDetector, mindfulOverlay

---

## File Map

```
wisemind-ai/
├── src/
│   ├── background/
│   │   ├── index.ts              # Service worker: wires Chrome events to engines
│   │   ├── TrackingEngine.ts
│   │   ├── ClassifierEngine.ts
│   │   ├── CoachingEngine.ts
│   │   ├── ScoringEngine.ts
│   │   ├── NotificationManager.ts
│   │   └── StorageManager.ts
│   ├── content/
│   │   ├── activityMonitor.ts
│   │   ├── shortVideoDetector.ts
│   │   └── mindfulOverlay.ts
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ScoreRing.tsx
│   │       ├── ScreenTimeBar.tsx
│   │       └── CoachingCard.tsx
│   ├── newtab/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ScoreCards.tsx
│   │       ├── Timeline.tsx
│   │       ├── ShortVideoReport.tsx
│   │       ├── GoalsProgress.tsx
│   │       ├── Achievements.tsx
│   │       ├── WeeklyReport.tsx
│   │       └── Recommendations.tsx
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ChatThread.tsx
│   │       ├── QuickPrompts.tsx
│   │       └── PanelTabs.tsx
│   ├── settings/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── shared/
│   │   ├── types.ts
│   │   ├── constants.ts          # Domain map, category labels
│   │   ├── db.ts                 # IndexedDB layer (idb)
│   │   ├── StorageManager.ts     # chrome.storage.local typed interface
│   │   ├── messaging.ts          # Typed chrome.runtime message bus
│   │   └── hooks/
│   │       ├── useStorage.ts
│   │       └── useScores.ts
│   └── test/
│       └── setup.ts              # Chrome API mocks + @testing-library/jest-dom
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/test/setup.ts`
- Create: `public/manifest.json`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm test` commands

- [ ] **Step 1: Initialise git and install dependencies**

```bash
cd "c:\Users\HASSAN\App2\counter"
git init
npm init -y
npm install react react-dom idb uuid clsx
npm install -D typescript vite @vitejs/plugin-react tailwindcss autoprefixer postcss \
  vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom @types/react @types/react-dom @types/chrome \
  @types/uuid
```

- [ ] **Step 2: Write `package.json` scripts**

```json
{
  "name": "wisemind-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  }
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        newtab: resolve(__dirname, 'src/newtab/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        settings: resolve(__dirname, 'src/settings/index.html'),
        activityMonitor: resolve(__dirname, 'src/content/activityMonitor.ts'),
        shortVideoDetector: resolve(__dirname, 'src/content/shortVideoDetector.ts'),
        mindfulOverlay: resolve(__dirname, 'src/content/mindfulOverlay.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
})
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
```

- [ ] **Step 5: Write `src/test/setup.ts`** (Chrome API mocks used by all tests)

```ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((defaults, cb) => cb?.(defaults)),
      set: vi.fn((_data, cb) => cb?.()),
      remove: vi.fn((_keys, cb) => cb?.()),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn(),
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  webNavigation: {
    onCompleted: { addListener: vi.fn() },
    onHistoryStateUpdated: { addListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  notifications: {
    create: vi.fn(),
  },
  idle: {
    onStateChanged: { addListener: vi.fn() },
    setDetectionInterval: vi.fn(),
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
    WINDOW_ID_NONE: -1,
  },
  sidePanel: {
    setPanelBehavior: vi.fn(),
  },
}

Object.defineProperty(global, 'chrome', { value: chromeMock, writable: true })
```

- [ ] **Step 6: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "types": ["chrome", "vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{tsx,ts,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          900: '#1e3a8a',
        },
        wellness: {
          green: '#10b981',
          teal: '#14b8a6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 8: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 9: Write `public/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "WiseMind AI",
  "version": "1.0.0",
  "description": "Your intelligent digital wellness coach",
  "permissions": [
    "tabs", "storage", "alarms", "notifications",
    "sidePanel", "scripting", "idle", "webNavigation"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "side_panel": { "default_path": "sidepanel.html" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["activityMonitor.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "*://*.youtube.com/*", "*://*.tiktok.com/*",
        "*://*.instagram.com/*", "*://*.facebook.com/*"
      ],
      "js": ["shortVideoDetector.js"],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 10: Create placeholder HTML entry files and stub index.ts**

Create `src/popup/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>WiseMind AI</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```
Repeat the same HTML structure for `src/newtab/index.html`, `src/sidepanel/index.html`, `src/settings/index.html` (changing `<title>` appropriately).

Create `src/background/index.ts` with a single line: `export {}`

Create stub files so Vite can resolve all entries:
```bash
mkdir -p src/content src/popup/components src/newtab/components src/sidepanel/components src/settings src/shared/hooks
touch src/content/activityMonitor.ts src/content/shortVideoDetector.ts src/content/mindfulOverlay.ts
touch src/popup/main.tsx src/newtab/main.tsx src/sidepanel/main.tsx src/settings/main.tsx
```

- [ ] **Step 11: Verify build succeeds**

```bash
npm run build
```
Expected: `dist/` directory created with `background.js`, `popup.html`, `newtab.html`, `sidepanel.html`, `settings.html`, `activityMonitor.js`, `shortVideoDetector.js`, `mindfulOverlay.js`.

- [ ] **Step 12: Verify tests run (zero tests = zero failures)**

```bash
npm test
```
Expected: `Test Files  0 passed`, exit 0.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite MV3 extension with TypeScript, React, Tailwind, Vitest"
```

---

### Task 2: Shared Types & Domain Constants

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/types.test.ts`

**Interfaces:**
- Produces: `Category`, `MentorPersonality`, `Theme`, `Visit`, `ShortVideoSession`, `CoachingEvent`, `DailySummary`, `Goal`, `Achievement`, `ExtensionSettings`, `ActiveSession`, `Scores`, `CoachingContext`, `ExtensionMessage`, `ShortVideoPlatform` — imported by every subsequent task.

- [ ] **Step 1: Write the failing type-guard test**

```ts
// src/shared/types.test.ts
import { describe, it, expect } from 'vitest'
import { isCategory, PRODUCTIVE_CATEGORIES } from './constants'

describe('isCategory', () => {
  it('returns true for valid category', () => {
    expect(isCategory('learning')).toBe(true)
  })
  it('returns false for invalid string', () => {
    expect(isCategory('invalid')).toBe(false)
  })
})

describe('PRODUCTIVE_CATEGORIES', () => {
  it('includes programming and learning', () => {
    expect(PRODUCTIVE_CATEGORIES).toContain('programming')
    expect(PRODUCTIVE_CATEGORIES).toContain('learning')
  })
  it('does not include entertainment', () => {
    expect(PRODUCTIVE_CATEGORIES).not.toContain('entertainment')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```
Expected: FAIL — `Cannot find module './constants'`

- [ ] **Step 3: Write `src/shared/types.ts`**

```ts
export type Category =
  | 'learning' | 'programming' | 'productivity' | 'ai_tools' | 'reading'
  | 'entertainment' | 'gaming' | 'social_media' | 'news' | 'shopping'
  | 'finance' | 'health' | 'communication' | 'other'

export type ShortVideoPlatform =
  | 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'facebook_reels'

export type MentorPersonality = 'wise' | 'friendly' | 'coach' | 'mindful' | 'funny'
export type Theme = 'dark' | 'light' | 'system'
export type CoachingFrequency = 'gentle' | 'moderate' | 'assertive'

export interface Visit {
  id: string
  url: string
  domain: string
  title: string
  startTime: number
  endTime: number
  duration: number       // seconds
  category: Category
  aiCategory: string
  classified: boolean
}

export interface ShortVideoSession {
  id: string
  platform: ShortVideoPlatform
  startTime: number
  endTime: number
  count: number
  duration: number       // seconds
}

export interface CoachingEvent {
  id: string
  timestamp: number
  type: 'mindful_checkin' | 'health_tip' | 'motivation' | 'goal_reminder'
  message: string
  userResponse: 'continue' | 'take_break' | 'dismissed' | null
  mood: 'energized' | 'fine' | 'tired' | 'just_scrolling' | null
}

export interface DailySummary {
  date: string           // "YYYY-MM-DD"
  totalTime: number      // seconds
  byCategory: Record<Category, number>
  shortVideoCount: number
  shortVideoDuration: number
  healthScore: number
  productivityScore: number
  learningScore: number
  breaks: number
  lateNightMinutes: number
  topSites: Array<{ domain: string; duration: number }>
}

export interface Goal {
  id: string
  type: 'reduce' | 'increase'
  target: Category | 'shorts' | 'sleep'
  dailyLimitMinutes: number | null
  weeklyTargetMinutes: number | null
  createdAt: number
  active: boolean
}

export interface Achievement {
  id: string
  unlockedAt: number
  seen: boolean
}

export interface ExtensionSettings {
  openrouterApiKey: string
  selectedModel: string
  mentorPersonality: MentorPersonality
  theme: Theme
  coachingEnabled: boolean
  coachingFrequency: CoachingFrequency
  coachingHours: { start: number; end: number }
  excludedDomains: string[]
  privateModeActive: boolean
  eyeHealthReminders: boolean
  lastHealthScore: number
  todaysSummary: DailySummary | null
  achievements: Achievement[]
  ruleLastFired: Record<string, number>
}

export interface ActiveSession {
  tabId: number
  url: string
  domain: string
  title: string
  startTime: number
}

export interface Scores {
  health: number
  productivity: number
  learning: number
}

export interface CoachingContext {
  continuousMinutes: number
  currentCategory: Category
  shortVideoCount: number
  shortVideoMinutes: number
  lateNight: boolean
  lastBreakMinutes: number
  todayHealthScore: number
  goals: Goal[]
  recentMood: string | null
  mentorPersonality: MentorPersonality
}

export type ExtensionMessage =
  | { type: 'SHORT_WATCHED'; payload: { platform: ShortVideoPlatform; count: number; duration: number } }
  | { type: 'ACTIVITY_SIGNAL'; payload: { scrollIntensity: number; videoPlaying: boolean; hasFocus: boolean; timestamp: number } }
  | { type: 'SCORE_UPDATE'; payload: Scores }
  | { type: 'SHOW_MINDFUL_CHECKIN'; payload: { message: string; stats: string } }
  | { type: 'COACHING_RESPONSE'; payload: { response: 'continue' | 'take_break' | 'dismissed'; mood: string | null } }
```

- [ ] **Step 4: Write `src/shared/constants.ts`**

```ts
import type { Category } from './types'

export const ALL_CATEGORIES: Category[] = [
  'learning', 'programming', 'productivity', 'ai_tools', 'reading',
  'entertainment', 'gaming', 'social_media', 'news', 'shopping',
  'finance', 'health', 'communication', 'other',
]

export const PRODUCTIVE_CATEGORIES: Category[] = [
  'learning', 'programming', 'productivity', 'ai_tools', 'reading', 'communication',
]

export const CATEGORY_LABELS: Record<Category, string> = {
  learning: 'Learning', programming: 'Programming', productivity: 'Productivity',
  ai_tools: 'AI Tools', reading: 'Reading', entertainment: 'Entertainment',
  gaming: 'Gaming', social_media: 'Social Media', news: 'News', shopping: 'Shopping',
  finance: 'Finance', health: 'Health', communication: 'Communication', other: 'Other',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  learning: '#10b981', programming: '#3b82f6', productivity: '#8b5cf6',
  ai_tools: '#06b6d4', reading: '#14b8a6', entertainment: '#f59e0b',
  gaming: '#ef4444', social_media: '#ec4899', news: '#6366f1',
  shopping: '#f97316', finance: '#84cc16', health: '#22c55e',
  communication: '#a78bfa', other: '#9ca3af',
}

export const DOMAIN_MAP: Record<string, Category> = {
  'github.com': 'programming', 'gitlab.com': 'programming',
  'stackoverflow.com': 'programming', 'developer.mozilla.org': 'programming',
  'codepen.io': 'programming', 'replit.com': 'programming',
  'leetcode.com': 'learning', 'coursera.org': 'learning',
  'udemy.com': 'learning', 'khanacademy.org': 'learning',
  'edx.org': 'learning', 'duolingo.com': 'learning',
  'brilliant.org': 'learning', 'codecademy.com': 'learning',
  'chatgpt.com': 'ai_tools', 'claude.ai': 'ai_tools',
  'gemini.google.com': 'ai_tools', 'copilot.microsoft.com': 'ai_tools',
  'perplexity.ai': 'ai_tools', 'openrouter.ai': 'ai_tools',
  'netflix.com': 'entertainment', 'disneyplus.com': 'entertainment',
  'twitch.tv': 'entertainment', 'primevideo.com': 'entertainment',
  'tiktok.com': 'entertainment', 'instagram.com': 'social_media',
  'twitter.com': 'social_media', 'x.com': 'social_media',
  'facebook.com': 'social_media', 'linkedin.com': 'communication',
  'reddit.com': 'social_media', 'discord.com': 'communication',
  'slack.com': 'communication', 'notion.so': 'productivity',
  'docs.google.com': 'productivity', 'sheets.google.com': 'productivity',
  'trello.com': 'productivity', 'asana.com': 'productivity',
  'amazon.com': 'shopping', 'ebay.com': 'shopping',
  'bbc.com': 'news', 'cnn.com': 'news', 'techcrunch.com': 'news',
  'medium.com': 'reading',
}

export function isCategory(value: string): value is Category {
  return ALL_CATEGORIES.includes(value as Category)
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function getDateString(timestamp: number = Date.now()): string {
  return new Date(timestamp).toISOString().split('T')[0]
}

export function getTodayRange(): { start: number; end: number } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return { start, end: start + 86_400_000 }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```
Expected: `2 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/constants.ts src/shared/types.test.ts
git commit -m "feat: add shared types and domain classification constants"
```

---

### Task 3: IndexedDB Layer

**Files:**
- Create: `src/shared/db.ts`
- Create: `src/shared/db.test.ts`

**Interfaces:**
- Consumes: `Visit`, `ShortVideoSession`, `CoachingEvent`, `DailySummary`, `Goal` from `../shared/types`
- Produces: `getDB`, `addVisit`, `getVisitsByDateRange`, `updateVisit`, `getUnclassifiedVisits`, `addShortVideoSession`, `getShortVideosByDateRange`, `addCoachingEvent`, `getDailySummary`, `putDailySummary`, `getLastNDailySummaries`, `getActiveGoals`, `addGoal`, `putGoal`

- [ ] **Step 1: Write failing tests**

```ts
// src/shared/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { addVisit, getVisitsByDateRange, getUnclassifiedVisits, updateVisit } from './db'
import type { Visit } from './types'

const makeVisit = (overrides: Partial<Visit> = {}): Visit => ({
  id: 'test-1',
  url: 'https://github.com',
  domain: 'github.com',
  title: 'GitHub',
  startTime: 1_000_000,
  endTime: 1_060_000,
  duration: 60,
  category: 'programming',
  aiCategory: '',
  classified: true,
  ...overrides,
})

describe('db visits', () => {
  it('adds and retrieves a visit by date range', async () => {
    const v = makeVisit({ id: 'v1', startTime: 1_000_000 })
    await addVisit(v)
    const results = await getVisitsByDateRange(0, 2_000_000)
    expect(results.some(r => r.id === 'v1')).toBe(true)
  })

  it('getUnclassifiedVisits returns only unclassified', async () => {
    await addVisit(makeVisit({ id: 'v2', classified: false }))
    await addVisit(makeVisit({ id: 'v3', classified: true }))
    const unclassified = await getUnclassifiedVisits()
    expect(unclassified.some(v => v.id === 'v2')).toBe(true)
    expect(unclassified.some(v => v.id === 'v3')).toBe(false)
  })

  it('updateVisit mutates the record', async () => {
    const v = makeVisit({ id: 'v4', classified: false })
    await addVisit(v)
    await updateVisit({ ...v, classified: true })
    const all = await getVisitsByDateRange(0, 2_000_000)
    const updated = all.find(r => r.id === 'v4')
    expect(updated?.classified).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 3: Write `src/shared/db.ts`**

```ts
import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type { Visit, ShortVideoSession, CoachingEvent, DailySummary, Goal } from './types'

interface WiseMindDB extends DBSchema {
  visits: { key: string; value: Visit; indexes: { 'by-startTime': number; 'by-domain': string } }
  shortVideos: { key: string; value: ShortVideoSession; indexes: { 'by-startTime': number } }
  coachingEvents: { key: string; value: CoachingEvent; indexes: { 'by-timestamp': number } }
  dailySummaries: { key: string; value: DailySummary }
  goals: { key: string; value: Goal }
}

let dbPromise: Promise<IDBPDatabase<WiseMindDB>> | null = null

export function getDB(): Promise<IDBPDatabase<WiseMindDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WiseMindDB>('wisemind_db', 1, {
      upgrade(db) {
        const vs = db.createObjectStore('visits', { keyPath: 'id' })
        vs.createIndex('by-startTime', 'startTime')
        vs.createIndex('by-domain', 'domain')
        const sv = db.createObjectStore('shortVideos', { keyPath: 'id' })
        sv.createIndex('by-startTime', 'startTime')
        const ce = db.createObjectStore('coachingEvents', { keyPath: 'id' })
        ce.createIndex('by-timestamp', 'timestamp')
        db.createObjectStore('dailySummaries', { keyPath: 'date' })
        db.createObjectStore('goals', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export async function addVisit(visit: Visit): Promise<void> {
  const db = await getDB()
  await db.add('visits', visit)
}

export async function updateVisit(visit: Visit): Promise<void> {
  const db = await getDB()
  await db.put('visits', visit)
}

export async function getVisitsByDateRange(start: number, end: number): Promise<Visit[]> {
  const db = await getDB()
  return db.getAllFromIndex('visits', 'by-startTime', IDBKeyRange.bound(start, end))
}

export async function getUnclassifiedVisits(): Promise<Visit[]> {
  const db = await getDB()
  const all = await db.getAll('visits')
  return all.filter(v => !v.classified)
}

export async function addShortVideoSession(session: ShortVideoSession): Promise<void> {
  const db = await getDB()
  await db.add('shortVideos', session)
}

export async function getShortVideosByDateRange(start: number, end: number): Promise<ShortVideoSession[]> {
  const db = await getDB()
  return db.getAllFromIndex('shortVideos', 'by-startTime', IDBKeyRange.bound(start, end))
}

export async function addCoachingEvent(event: CoachingEvent): Promise<void> {
  const db = await getDB()
  await db.add('coachingEvents', event)
}

export async function getDailySummary(date: string): Promise<DailySummary | undefined> {
  const db = await getDB()
  return db.get('dailySummaries', date)
}

export async function putDailySummary(summary: DailySummary): Promise<void> {
  const db = await getDB()
  await db.put('dailySummaries', summary)
}

export async function getLastNDailySummaries(n: number): Promise<DailySummary[]> {
  const db = await getDB()
  const all = await db.getAll('dailySummaries')
  return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)
}

export async function getActiveGoals(): Promise<Goal[]> {
  const db = await getDB()
  const all = await db.getAll('goals')
  return all.filter(g => g.active)
}

export async function addGoal(goal: Goal): Promise<void> {
  const db = await getDB()
  await db.add('goals', goal)
}

export async function putGoal(goal: Goal): Promise<void> {
  const db = await getDB()
  await db.put('goals', goal)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/db.ts src/shared/db.test.ts
git commit -m "feat: add IndexedDB layer with typed idb schema"
```

---

### Task 4: StorageManager (chrome.storage.local)

**Files:**
- Create: `src/shared/StorageManager.ts`
- Create: `src/shared/StorageManager.test.ts`

**Interfaces:**
- Consumes: `ExtensionSettings`, `DailySummary`, `Achievement` from `./types`
- Produces: `DEFAULT_SETTINGS`, `getSettings`, `updateSettings`, `getApiKey`, `isPrivateMode`, `isDomainExcluded`, `markRuleFired`, `getRuleLastFired`

- [ ] **Step 1: Write failing tests**

```ts
// src/shared/StorageManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSettings, updateSettings, isDomainExcluded, DEFAULT_SETTINGS } from './StorageManager'

beforeEach(() => {
  vi.mocked(chrome.storage.local.get).mockImplementation((_defaults, cb) => {
    cb?.({ ...DEFAULT_SETTINGS })
  })
  vi.mocked(chrome.storage.local.set).mockImplementation((_data, cb) => cb?.())
})

describe('getSettings', () => {
  it('returns default settings when storage is empty', async () => {
    const settings = await getSettings()
    expect(settings.selectedModel).toBe('openai/gpt-4o-mini')
    expect(settings.coachingEnabled).toBe(true)
  })
})

describe('updateSettings', () => {
  it('calls chrome.storage.local.set with the partial update', async () => {
    await updateSettings({ coachingEnabled: false })
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { coachingEnabled: false },
      expect.any(Function)
    )
  })
})

describe('isDomainExcluded', () => {
  it('returns true when domain is in excludedDomains', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementationOnce((_d, cb) => {
      cb?.({ ...DEFAULT_SETTINGS, excludedDomains: ['facebook.com'] })
    })
    expect(await isDomainExcluded('facebook.com')).toBe(true)
  })

  it('returns false when domain is not excluded', async () => {
    expect(await isDomainExcluded('github.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './StorageManager'`

- [ ] **Step 3: Write `src/shared/StorageManager.ts`**

```ts
import type { ExtensionSettings } from './types'

export const DEFAULT_SETTINGS: ExtensionSettings = {
  openrouterApiKey: '',
  selectedModel: 'openai/gpt-4o-mini',
  mentorPersonality: 'wise',
  theme: 'system',
  coachingEnabled: true,
  coachingFrequency: 'moderate',
  coachingHours: { start: 9, end: 22 },
  excludedDomains: [],
  privateModeActive: false,
  eyeHealthReminders: true,
  lastHealthScore: 0,
  todaysSummary: null,
  achievements: [],
  ruleLastFired: {},
}

export function getSettings(): Promise<ExtensionSettings> {
  return new Promise(resolve => {
    chrome.storage.local.get(DEFAULT_SETTINGS, result => {
      resolve(result as ExtensionSettings)
    })
  })
}

export function updateSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set(partial, resolve)
  })
}

export async function getApiKey(): Promise<string> {
  return (await getSettings()).openrouterApiKey
}

export async function isPrivateMode(): Promise<boolean> {
  return (await getSettings()).privateModeActive
}

export async function isDomainExcluded(domain: string): Promise<boolean> {
  const { excludedDomains } = await getSettings()
  return excludedDomains.includes(domain)
}

export async function markRuleFired(ruleId: string): Promise<void> {
  const { ruleLastFired } = await getSettings()
  await updateSettings({ ruleLastFired: { ...ruleLastFired, [ruleId]: Date.now() } })
}

export async function getRuleLastFired(ruleId: string): Promise<number> {
  const { ruleLastFired } = await getSettings()
  return ruleLastFired[ruleId] ?? 0
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/StorageManager.ts src/shared/StorageManager.test.ts
git commit -m "feat: add StorageManager for chrome.storage.local with typed defaults"
```

---

### Task 5: Message Bus

**Files:**
- Create: `src/shared/messaging.ts`
- Create: `src/shared/messaging.test.ts`

**Interfaces:**
- Consumes: `ExtensionMessage` from `./types`
- Produces: `sendMessage(msg: ExtensionMessage): void`, `onMessage(handler): void`

- [ ] **Step 1: Write failing test**

```ts
// src/shared/messaging.test.ts
import { describe, it, expect, vi } from 'vitest'
import { sendMessage, onMessage } from './messaging'

describe('sendMessage', () => {
  it('calls chrome.runtime.sendMessage with the message', () => {
    sendMessage({ type: 'SCORE_UPDATE', payload: { health: 80, productivity: 70, learning: 60 } })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SCORE_UPDATE',
      payload: { health: 80, productivity: 70, learning: 60 },
    })
  })
})

describe('onMessage', () => {
  it('registers a listener on chrome.runtime.onMessage', () => {
    const handler = vi.fn()
    onMessage(handler)
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function))
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './messaging'`

- [ ] **Step 3: Write `src/shared/messaging.ts`**

```ts
import type { ExtensionMessage } from './types'

export function sendMessage(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message)
}

export function onMessage(
  handler: (message: ExtensionMessage, sender: chrome.runtime.MessageSender) => void
): void {
  chrome.runtime.onMessage.addListener((msg, sender) => {
    handler(msg as ExtensionMessage, sender)
  })
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/messaging.ts src/shared/messaging.test.ts
git commit -m "feat: add typed chrome.runtime message bus"
```

---

### Task 6: TrackingEngine

**Files:**
- Create: `src/background/TrackingEngine.ts`
- Create: `src/background/TrackingEngine.test.ts`

**Interfaces:**
- Consumes: `ActiveSession`, `Visit` from `../shared/types`; `getDomainFromUrl`, `getDateString` from `../shared/constants`; `addVisit` from `../shared/db`; `isPrivateMode`, `isDomainExcluded` from `../shared/StorageManager`
- Produces: `TrackingEngine` class with `init(): void`

- [ ] **Step 1: Write failing tests**

```ts
// src/background/TrackingEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrackingEngine } from './TrackingEngine'

vi.mock('../shared/db', () => ({ addVisit: vi.fn() }))
vi.mock('../shared/StorageManager', () => ({
  isPrivateMode: vi.fn().mockResolvedValue(false),
  isDomainExcluded: vi.fn().mockResolvedValue(false),
}))

import { addVisit } from '../shared/db'
import { isPrivateMode } from '../shared/StorageManager'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TrackingEngine.endSession', () => {
  it('discards sessions shorter than 5 seconds', async () => {
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 3000,
    }
    await engine['endSession']()
    expect(addVisit).not.toHaveBeenCalled()
  })

  it('saves sessions 5+ seconds to IndexedDB', async () => {
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 10000,
    }
    await engine['endSession']()
    expect(addVisit).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'github.com',
      duration: expect.any(Number),
    }))
  })

  it('skips saving when private mode is active', async () => {
    vi.mocked(isPrivateMode).mockResolvedValueOnce(true)
    const engine = new TrackingEngine()
    engine['activeSession'] = {
      tabId: 1, url: 'https://github.com', domain: 'github.com',
      title: 'GitHub', startTime: Date.now() - 10000,
    }
    await engine['endSession']()
    expect(addVisit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './TrackingEngine'`

- [ ] **Step 3: Write `src/background/TrackingEngine.ts`**

```ts
import { v4 as uuid } from 'uuid'
import type { ActiveSession, Visit } from '../shared/types'
import { getDomainFromUrl, DOMAIN_MAP } from '../shared/constants'
import { addVisit } from '../shared/db'
import { isPrivateMode, isDomainExcluded } from '../shared/StorageManager'

const MIN_SESSION_SECONDS = 5

export class TrackingEngine {
  private activeSession: ActiveSession | null = null

  init(): void {
    chrome.tabs.onActivated.addListener(info => this.handleTabActivated(info))
    chrome.webNavigation.onCompleted.addListener(details => {
      if (details.frameId === 0) this.handleNavigation(details)
    })
    chrome.idle.onStateChanged.addListener(state => this.handleIdle(state))
    chrome.windows.onFocusChanged.addListener(id => this.handleWindowFocus(id))
  }

  private async handleTabActivated(info: chrome.tabs.TabActiveInfo): Promise<void> {
    await this.endSession()
    const tab = await chrome.tabs.get(info.tabId).catch(() => null)
    if (tab?.url) {
      await this.startSession(info.tabId, tab.url, tab.title ?? '')
    }
  }

  private async handleNavigation(
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails
  ): Promise<void> {
    await this.endSession()
    const tab = await chrome.tabs.get(details.tabId).catch(() => null)
    if (tab?.url) {
      await this.startSession(details.tabId, details.url, tab.title ?? '')
    }
  }

  private async handleIdle(state: string): Promise<void> {
    if (state === 'idle' || state === 'locked') {
      await this.endSession()
    }
  }

  private async handleWindowFocus(windowId: number): Promise<void> {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await this.endSession()
    }
  }

  private async startSession(tabId: number, url: string, title: string): Promise<void> {
    if (!url.startsWith('http')) return
    const domain = getDomainFromUrl(url)
    if (await isDomainExcluded(domain)) return
    this.activeSession = { tabId, url, domain, title, startTime: Date.now() }
  }

  private async endSession(): Promise<void> {
    if (!this.activeSession) return
    if (await isPrivateMode()) { this.activeSession = null; return }

    const session = this.activeSession
    this.activeSession = null
    const endTime = Date.now()
    const duration = Math.round((endTime - session.startTime) / 1000)

    if (duration < MIN_SESSION_SECONDS) return

    const category = DOMAIN_MAP[session.domain] ?? 'other'
    const visit: Visit = {
      id: uuid(),
      url: session.url,
      domain: session.domain,
      title: session.title,
      startTime: session.startTime,
      endTime,
      duration,
      category,
      aiCategory: '',
      classified: category !== 'other',
    }
    await addVisit(visit)
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `13 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/background/TrackingEngine.ts src/background/TrackingEngine.test.ts
git commit -m "feat: add TrackingEngine — tab session tracking with idle and privacy gates"
```

---

### Task 7: ClassifierEngine

**Files:**
- Create: `src/background/ClassifierEngine.ts`
- Create: `src/background/ClassifierEngine.test.ts`

**Interfaces:**
- Consumes: `Visit`, `Category` from `../shared/types`; `DOMAIN_MAP`, `isCategory` from `../shared/constants`; `getUnclassifiedVisits`, `updateVisit` from `../shared/db`; `getApiKey`, `getSettings` from `../shared/StorageManager`
- Produces: `ClassifierEngine` class with `init(): void`, `runBatch(): Promise<void>`

- [ ] **Step 1: Write failing tests**

```ts
// src/background/ClassifierEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClassifierEngine } from './ClassifierEngine'

vi.mock('../shared/db', () => ({
  getUnclassifiedVisits: vi.fn().mockResolvedValue([]),
  updateVisit: vi.fn(),
}))
vi.mock('../shared/StorageManager', () => ({
  getApiKey: vi.fn().mockResolvedValue('test-key'),
  getSettings: vi.fn().mockResolvedValue({ selectedModel: 'openai/gpt-4o-mini', privateModeActive: false }),
}))

import { updateVisit } from '../shared/db'

beforeEach(() => vi.clearAllMocks())

describe('ClassifierEngine.localClassify', () => {
  const engine = new ClassifierEngine()

  it('returns correct category for known domain', () => {
    expect(engine['localClassify']('github.com')).toBe('programming')
    expect(engine['localClassify']('netflix.com')).toBe('entertainment')
  })

  it('returns null for unknown domain', () => {
    expect(engine['localClassify']('some-random-site.xyz')).toBeNull()
  })
})

describe('ClassifierEngine.runBatch', () => {
  it('does nothing when no unclassified visits', async () => {
    const engine = new ClassifierEngine()
    await engine.runBatch()
    expect(updateVisit).not.toHaveBeenCalled()
  })

  it('updates visits when AI returns valid classification', async () => {
    const { getUnclassifiedVisits } = await import('../shared/db')
    vi.mocked(getUnclassifiedVisits).mockResolvedValueOnce([{
      id: 'v1', url: 'https://medium.com/article', domain: 'medium.com',
      title: 'Understanding Neural Networks', startTime: 0, endTime: 60000,
      duration: 60, category: 'other', aiCategory: '', classified: false,
    }])

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          results: [{ id: 'v1', category: 'learning', aiCategory: 'machine learning article' }]
        })}}]
      }),
    }) as unknown as typeof fetch

    const engine = new ClassifierEngine()
    await engine.runBatch()
    expect(updateVisit).toHaveBeenCalledWith(expect.objectContaining({
      id: 'v1', category: 'learning', classified: true,
    }))
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './ClassifierEngine'`

- [ ] **Step 3: Write `src/background/ClassifierEngine.ts`**

```ts
import type { Visit, Category } from '../shared/types'
import { DOMAIN_MAP, isCategory } from '../shared/constants'
import { getUnclassifiedVisits, updateVisit } from '../shared/db'
import { getApiKey, getSettings } from '../shared/StorageManager'

const BATCH_SIZE = 10
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class ClassifierEngine {
  init(): void {
    chrome.alarms.create('classifyBatch', { periodInMinutes: 2 })
  }

  localClassify(domain: string): Category | null {
    return DOMAIN_MAP[domain] ?? null
  }

  async runBatch(): Promise<void> {
    const apiKey = await getApiKey()
    if (!apiKey) return

    const unclassified = await getUnclassifiedVisits()
    if (unclassified.length === 0) return

    const batch = unclassified.slice(0, BATCH_SIZE)
    const items = batch.map(v => ({ id: v.id, url: v.url, title: v.title }))

    const systemPrompt = `You are a website activity classifier. Given browsing sessions, return JSON with key "results": an array of {id, category, aiCategory}. category must be one of: learning, programming, productivity, ai_tools, reading, entertainment, gaming, social_media, news, shopping, finance, health, communication, other. aiCategory is a short descriptive label.`

    const { selectedModel } = await getSettings()

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://wisemind-ai',
          'X-Title': 'WiseMind AI',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(items) },
          ],
          response_format: { type: 'json_object' },
        }),
      })

      if (!res.ok) return

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) return

      const parsed = JSON.parse(content) as { results: Array<{ id: string; category: string; aiCategory: string }> }
      const resultMap = new Map(parsed.results.map(r => [r.id, r]))

      for (const visit of batch) {
        const result = resultMap.get(visit.id)
        if (!result) continue
        const category = isCategory(result.category) ? result.category : 'other'
        await updateVisit({ ...visit, category, aiCategory: result.aiCategory, classified: true })
      }
    } catch {
      // Silent — will retry on next batch cycle
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `17 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/background/ClassifierEngine.ts src/background/ClassifierEngine.test.ts
git commit -m "feat: add ClassifierEngine with local domain map and OpenRouter batch classification"
```

---

### Task 8: ScoringEngine

**Files:**
- Create: `src/background/ScoringEngine.ts`
- Create: `src/background/ScoringEngine.test.ts`

**Interfaces:**
- Consumes: `Visit`, `ShortVideoSession`, `DailySummary`, `Scores`, `ExtensionSettings` from `../shared/types`; `PRODUCTIVE_CATEGORIES` from `../shared/constants`; `getVisitsByDateRange`, `getShortVideosByDateRange`, `putDailySummary` from `../shared/db`; `getSettings`, `updateSettings` from `../shared/StorageManager`; `getTodayRange`, `getDateString` from `../shared/constants`
- Produces: `ScoringEngine` class with `computeAndStore(): Promise<Scores>`

- [ ] **Step 1: Write failing tests**

```ts
// src/background/ScoringEngine.test.ts
import { describe, it, expect } from 'vitest'
import { ScoringEngine } from './ScoringEngine'
import type { Visit, ShortVideoSession, ExtensionSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/StorageManager'

const makeVisit = (category: Visit['category'], duration: number): Visit => ({
  id: 'v', url: '', domain: '', title: '', startTime: 0, endTime: 0,
  duration, category, aiCategory: '', classified: true,
})

const settings: ExtensionSettings = { ...DEFAULT_SETTINGS }

describe('ScoringEngine.computeHealthScore', () => {
  const engine = new ScoringEngine()

  it('returns 100 for a perfect day (30+ min learning, ≤2h entertainment, 3+ breaks, no late night)', () => {
    const visits: Visit[] = [
      makeVisit('learning', 2000),
      makeVisit('entertainment', 3000),
    ]
    const score = engine['computeHealthScore'](visits, [], 3, 0, settings)
    expect(score).toBe(100)
  })

  it('deducts for entertainment over 2 hours', () => {
    const visits: Visit[] = [
      makeVisit('learning', 2000),
      makeVisit('entertainment', 8000),
    ]
    const score = engine['computeHealthScore'](visits, [], 3, 0, settings)
    expect(score).toBeLessThan(100)
  })

  it('deducts for late-night usage', () => {
    const visits: Visit[] = [makeVisit('learning', 2000)]
    const score = engine['computeHealthScore'](visits, [], 3, 15, settings)
    expect(score).toBeLessThan(100)
  })
})

describe('ScoringEngine.computeProductivityScore', () => {
  const engine = new ScoringEngine()

  it('returns high score for all productive time', () => {
    const visits: Visit[] = [
      makeVisit('programming', 3600),
      makeVisit('learning', 1800),
    ]
    const score = engine['computeProductivityScore'](visits, [], 0)
    expect(score).toBeGreaterThan(80)
  })

  it('penalises heavy short-video consumption', () => {
    const visits: Visit[] = [makeVisit('entertainment', 3600)]
    const scoreLight = engine['computeProductivityScore'](visits, [], 10)
    const scoreHeavy = engine['computeProductivityScore'](visits, [], 40)
    expect(scoreHeavy).toBeLessThan(scoreLight)
  })
})

describe('ScoringEngine.computeLearningScore', () => {
  const engine = new ScoringEngine()

  it('scales with learning minutes up to 70 pts at 60 min', () => {
    const visits60 = [makeVisit('learning', 3600)]
    const visits30 = [makeVisit('learning', 1800)]
    const score60 = engine['computeLearningScore'](visits60, false)
    const score30 = engine['computeLearningScore'](visits30, false)
    expect(score60).toBeGreaterThan(score30)
    expect(score60).toBeGreaterThanOrEqual(70)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './ScoringEngine'`

- [ ] **Step 3: Write `src/background/ScoringEngine.ts`**

```ts
import type { Visit, ShortVideoSession, Scores, ExtensionSettings } from '../shared/types'
import { PRODUCTIVE_CATEGORIES, getTodayRange, getDateString } from '../shared/constants'
import { getVisitsByDateRange, getShortVideosByDateRange, putDailySummary, getDailySummary } from '../shared/db'
import { getSettings, updateSettings } from '../shared/StorageManager'

export class ScoringEngine {
  async computeAndStore(): Promise<Scores> {
    const { start, end } = getTodayRange()
    const [visits, shortVideos, settings] = await Promise.all([
      getVisitsByDateRange(start, end),
      getShortVideosByDateRange(start, end),
      getSettings(),
    ])

    const now = new Date()
    const lateNightMinutes = visits
      .filter(v => { const h = new Date(v.startTime).getHours(); return h >= 23 || h < 6 })
      .reduce((s, v) => s + v.duration / 60, 0)

    const breakCount = await this.getBreakCount()

    const health = this.computeHealthScore(visits, shortVideos, breakCount, lateNightMinutes, settings)
    const productivity = this.computeProductivityScore(visits, shortVideos, shortVideos.reduce((s, sv) => s + sv.count, 0))
    const learningStreak = await this.getLearningStreak()
    const learning = this.computeLearningScore(visits, learningStreak >= 7)

    const scores: Scores = { health, productivity, learning }

    const byCategory = {} as Record<string, number>
    for (const v of visits) {
      byCategory[v.category] = (byCategory[v.category] ?? 0) + v.duration
    }

    const topSites = Object.entries(
      visits.reduce((acc, v) => { acc[v.domain] = (acc[v.domain] ?? 0) + v.duration; return acc }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([domain, duration]) => ({ domain, duration }))

    const date = getDateString()
    const existing = await getDailySummary(date)

    await putDailySummary({
      date,
      totalTime: visits.reduce((s, v) => s + v.duration, 0),
      byCategory: byCategory as any,
      shortVideoCount: shortVideos.reduce((s, sv) => s + sv.count, 0),
      shortVideoDuration: shortVideos.reduce((s, sv) => s + sv.duration, 0),
      healthScore: health,
      productivityScore: productivity,
      learningScore: learning,
      breaks: breakCount,
      lateNightMinutes: Math.round(lateNightMinutes),
      topSites,
    })

    await updateSettings({ lastHealthScore: health, todaysSummary: { date, totalTime: 0, byCategory: byCategory as any, shortVideoCount: 0, shortVideoDuration: 0, healthScore: health, productivityScore: productivity, learningScore: learning, breaks: breakCount, lateNightMinutes: Math.round(lateNightMinutes), topSites } })

    return scores
  }

  private async getBreakCount(): Promise<number> {
    // Breaks tracked via idle state changes stored in settings
    const { todaysSummary } = await getSettings()
    return todaysSummary?.breaks ?? 0
  }

  private async getLearningStreak(): Promise<number> {
    const { getLastNDailySummaries } = await import('../shared/db')
    const summaries = await getLastNDailySummaries(8)
    let streak = 0
    const today = getDateString()
    for (const s of summaries) {
      if (s.date === today) continue
      if ((s.byCategory as any)['learning'] > 0 || (s.byCategory as any)['programming'] > 0) streak++
      else break
    }
    return streak
  }

  computeHealthScore(
    visits: Visit[],
    _shortVideos: ShortVideoSession[],
    breakCount: number,
    lateNightMinutes: number,
    _settings: ExtensionSettings
  ): number {
    let score = 100

    // Sleep dimension (20 pts): deduct 2 per 10 min late-night
    const sleepDeduction = Math.min(20, Math.floor(lateNightMinutes / 10) * 2)
    score -= sleepDeduction

    // Learning dimension (20 pts)
    const learningSeconds = visits.filter(v => v.category === 'learning' || v.category === 'programming').reduce((s, v) => s + v.duration, 0)
    const learningMinutes = learningSeconds / 60
    if (learningMinutes < 30) {
      score -= Math.round((1 - learningMinutes / 30) * 20)
    }

    // Entertainment dimension (20 pts): deduct 3 per 30 min over 2h
    const entertainmentMinutes = visits.filter(v => v.category === 'entertainment').reduce((s, v) => s + v.duration, 0) / 60
    if (entertainmentMinutes > 120) {
      score -= Math.min(20, Math.floor((entertainmentMinutes - 120) / 30) * 3)
    }

    // Breaks dimension (20 pts): deduct 5 per missed break below 3
    if (breakCount < 3) score -= (3 - breakCount) * 5

    return Math.max(0, Math.min(100, score))
  }

  computeProductivityScore(visits: Visit[], _shortVideos: ShortVideoSession[], shortVideoCount: number): number {
    const total = visits.reduce((s, v) => s + v.duration, 0)
    if (total === 0) return 0

    const productive = visits
      .filter(v => PRODUCTIVE_CATEGORIES.includes(v.category))
      .reduce((s, v) => s + v.duration, 0)

    let score = Math.round((productive / total) * 100)
    if (shortVideoCount > 30) score -= 10
    return Math.max(0, Math.min(100, score))
  }

  computeLearningScore(visits: Visit[], hasLearningStreak: boolean): number {
    const learningSeconds = visits
      .filter(v => ['learning', 'programming', 'reading'].includes(v.category))
      .reduce((s, v) => s + v.duration, 0)
    const learningMinutes = learningSeconds / 60

    let score = Math.round(Math.min(learningMinutes / 60, 1) * 70)
    if (hasLearningStreak) score += 15
    return Math.max(0, Math.min(100, score))
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `23 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/background/ScoringEngine.ts src/background/ScoringEngine.test.ts
git commit -m "feat: add ScoringEngine — health, productivity, learning score computation"
```

---

### Task 9: CoachingEngine

**Files:**
- Create: `src/background/CoachingEngine.ts`
- Create: `src/background/CoachingEngine.test.ts`

**Interfaces:**
- Consumes: `CoachingContext`, `ExtensionSettings` from `../shared/types`; `getSettings`, `markRuleFired`, `getRuleLastFired` from `../shared/StorageManager`; `getShortVideosByDateRange`, `addCoachingEvent` from `../shared/db`; `getTodayRange` from `../shared/constants`
- Produces: `CoachingEngine` class with `init(): void`, `evaluateRules(): Promise<string | null>`

- [ ] **Step 1: Write failing tests**

```ts
// src/background/CoachingEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CoachingEngine } from './CoachingEngine'
import { DEFAULT_SETTINGS } from '../shared/StorageManager'

vi.mock('../shared/StorageManager', () => ({
  DEFAULT_SETTINGS: {
    coachingEnabled: true, privateModeActive: false,
    coachingHours: { start: 9, end: 22 }, mentorPersonality: 'wise',
    selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key',
    ruleLastFired: {},
  },
  getSettings: vi.fn().mockResolvedValue({
    coachingEnabled: true, privateModeActive: false,
    coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
    selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'test-key',
    ruleLastFired: {},
  }),
  markRuleFired: vi.fn(),
  getRuleLastFired: vi.fn().mockResolvedValue(0),
}))
vi.mock('../shared/db', () => ({
  getShortVideosByDateRange: vi.fn().mockResolvedValue([]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
  addCoachingEvent: vi.fn(),
}))

beforeEach(() => vi.clearAllMocks())

describe('CoachingEngine gate checks', () => {
  it('returns null when coachingEnabled is false', async () => {
    const { getSettings } = await import('../shared/StorageManager')
    vi.mocked(getSettings).mockResolvedValueOnce({
      coachingEnabled: false, privateModeActive: false,
      coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
      selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key', ruleLastFired: {},
    } as any)
    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).toBeNull()
  })

  it('returns null when privateModeActive is true', async () => {
    const { getSettings } = await import('../shared/StorageManager')
    vi.mocked(getSettings).mockResolvedValueOnce({
      coachingEnabled: true, privateModeActive: true,
      coachingHours: { start: 0, end: 24 }, mentorPersonality: 'wise',
      selectedModel: 'openai/gpt-4o-mini', openrouterApiKey: 'key', ruleLastFired: {},
    } as any)
    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).toBeNull()
  })
})

describe('CoachingEngine rule: short video', () => {
  it('fires when short video count exceeds 50', async () => {
    const { getShortVideosByDateRange } = await import('../shared/db')
    vi.mocked(getShortVideosByDateRange).mockResolvedValueOnce([
      { id: 's1', platform: 'youtube_shorts', count: 55, duration: 1800, startTime: 0, endTime: 0 },
    ])
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'You have watched many Shorts today.' } }] }),
    }) as any

    const engine = new CoachingEngine()
    const result = await engine.evaluateRules()
    expect(result).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './CoachingEngine'`

- [ ] **Step 3: Write `src/background/CoachingEngine.ts`**

```ts
import type { CoachingContext, Goal } from '../shared/types'
import { getSettings, markRuleFired, getRuleLastFired } from '../shared/StorageManager'
import { getShortVideosByDateRange, getVisitsByDateRange, addCoachingEvent } from '../shared/db'
import { getTodayRange } from '../shared/constants'
import { v4 as uuid } from 'uuid'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const PERSONALITY_TONES: Record<string, string> = {
  wise: 'Calm, thoughtful, like an experienced mentor. Ask reflective questions.',
  friendly: 'Relaxed, positive, encouraging, casual language.',
  coach: 'Disciplined, direct, challenges excuses, motivates action.',
  mindful: 'Peaceful, focuses on breathing and stress reduction.',
  funny: 'Playful, uses light humour, never mean-spirited.',
}

interface Rule {
  id: string
  cooldownMs: number
  type: 'mindful_checkin' | 'health_tip' | 'motivation' | 'goal_reminder'
  check: (ctx: CoachingContext) => boolean
  triggerLabel: string
}

const RULES: Rule[] = [
  {
    id: 'late_night', cooldownMs: 30 * 60_000, type: 'health_tip',
    check: ctx => ctx.lateNight && ctx.continuousMinutes > 20,
    triggerLabel: 'Late night browsing over 20 minutes',
  },
  {
    id: 'shorts_overload', cooldownMs: 30 * 60_000, type: 'mindful_checkin',
    check: ctx => ctx.shortVideoCount > 50,
    triggerLabel: 'Short video count exceeded 50',
  },
  {
    id: 'long_session', cooldownMs: 45 * 60_000, type: 'health_tip',
    check: ctx => ctx.continuousMinutes > 90,
    triggerLabel: 'Continuous browsing over 90 minutes',
  },
  {
    id: 'goal_nudge', cooldownMs: 60 * 60_000, type: 'goal_reminder',
    check: ctx => ctx.goals.length > 0 && ctx.currentCategory === 'entertainment' && ctx.continuousMinutes > 30,
    triggerLabel: 'Entertainment while learning goal active',
  },
  {
    id: 'focus_praise', cooldownMs: 60 * 60_000, type: 'motivation',
    check: ctx => ['programming', 'learning'].includes(ctx.currentCategory) && ctx.continuousMinutes > 45,
    triggerLabel: 'Deep focus session over 45 minutes',
  },
  {
    id: 'eye_health', cooldownMs: 20 * 60_000, type: 'health_tip',
    check: ctx => ctx.continuousMinutes > 0 && ctx.continuousMinutes % 20 < 5,
    triggerLabel: '20-20-20 eye health reminder',
  },
]

export class CoachingEngine {
  private sessionStartTime: number = Date.now()

  init(): void {
    chrome.alarms.create('coachingTick', { periodInMinutes: 5 })
    this.sessionStartTime = Date.now()
  }

  async evaluateRules(): Promise<string | null> {
    const settings = await getSettings()

    if (!settings.coachingEnabled) return null
    if (settings.privateModeActive) return null
    if (!settings.openrouterApiKey) return null

    const hour = new Date().getHours()
    if (hour < settings.coachingHours.start || hour >= settings.coachingHours.end) return null

    const ctx = await this.gatherContext(settings)

    for (const rule of RULES) {
      if (!rule.check(ctx)) continue
      const lastFired = await getRuleLastFired(rule.id)
      if (Date.now() - lastFired < rule.cooldownMs) continue

      const message = await this.generateMessage(rule.triggerLabel, ctx, settings)
      if (!message) continue

      await markRuleFired(rule.id)
      await addCoachingEvent({
        id: uuid(), timestamp: Date.now(), type: rule.type,
        message, userResponse: null, mood: null,
      })
      return message
    }

    return null
  }

  private async gatherContext(settings: Awaited<ReturnType<typeof getSettings>>): Promise<CoachingContext> {
    const { start, end } = getTodayRange()
    const [visits, shortVideos] = await Promise.all([
      getVisitsByDateRange(start, end),
      getShortVideosByDateRange(start, end),
    ])

    const now = Date.now()
    const continuousMinutes = Math.round((now - this.sessionStartTime) / 60_000)
    const lastVisit = visits[visits.length - 1]
    const currentCategory = lastVisit?.category ?? 'other'
    const shortVideoCount = shortVideos.reduce((s, sv) => s + sv.count, 0)
    const shortVideoMinutes = Math.round(shortVideos.reduce((s, sv) => s + sv.duration, 0) / 60)
    const hour = new Date().getHours()
    const lateNight = hour >= 23 || hour < 6

    return {
      continuousMinutes, currentCategory, shortVideoCount, shortVideoMinutes,
      lateNight, lastBreakMinutes: 0, todayHealthScore: settings.lastHealthScore,
      goals: [], recentMood: null, mentorPersonality: settings.mentorPersonality,
    }
  }

  private async generateMessage(
    triggerLabel: string,
    ctx: CoachingContext,
    settings: Awaited<ReturnType<typeof getSettings>>
  ): Promise<string | null> {
    const tone = PERSONALITY_TONES[settings.mentorPersonality] ?? PERSONALITY_TONES.wise
    const system = `You are a digital wellness coach inside a Chrome extension. Tone: ${tone}. Be concise (2-3 sentences max). Never shame the user. Never start with "I".`
    const user = `Rule triggered: ${triggerLabel}. Context: continuous browsing ${ctx.continuousMinutes} min, ${ctx.shortVideoCount} short videos today, current activity: ${ctx.currentCategory}, late night: ${ctx.lateNight}. Generate a short coaching message.`

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://wisemind-ai',
          'X-Title': 'WiseMind AI',
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() ?? null
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `27 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/background/CoachingEngine.ts src/background/CoachingEngine.test.ts
git commit -m "feat: add CoachingEngine with 6 priority rules, cooldowns, and OpenRouter message generation"
```

---

### Task 10: NotificationManager

**Files:**
- Create: `src/background/NotificationManager.ts`
- Create: `src/background/NotificationManager.test.ts`

**Interfaces:**
- Consumes: `ExtensionMessage` from `../shared/types`; `sendMessage` from `../shared/messaging`
- Produces: `NotificationManager` class with `deliver(message: string, stats?: string): void`

- [ ] **Step 1: Write failing tests**

```ts
// src/background/NotificationManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationManager } from './NotificationManager'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'

beforeEach(() => vi.clearAllMocks())

describe('NotificationManager.deliver', () => {
  it('sends SHOW_MINDFUL_CHECKIN message', () => {
    const nm = new NotificationManager()
    nm.deliver('Take a break', 'You have been browsing for 90 minutes')
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHOW_MINDFUL_CHECKIN',
      payload: { message: 'Take a break', stats: 'You have been browsing for 90 minutes' },
    })
  })

  it('falls back to chrome.notifications when content script unavailable', () => {
    const nm = new NotificationManager()
    vi.mocked(sendMessage).mockImplementationOnce(() => { throw new Error('no receiver') })
    nm.deliver('Drink water')
    expect(chrome.notifications.create).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './NotificationManager'`

- [ ] **Step 3: Write `src/background/NotificationManager.ts`**

```ts
import { sendMessage } from '../shared/messaging'

export class NotificationManager {
  deliver(message: string, stats: string = ''): void {
    try {
      sendMessage({ type: 'SHOW_MINDFUL_CHECKIN', payload: { message, stats } })
    } catch {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'WiseMind AI',
        message,
      })
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `29 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/background/NotificationManager.ts src/background/NotificationManager.test.ts
git commit -m "feat: add NotificationManager with overlay and system notification fallback"
```

---

### Task 11: Background Service Worker Entry Point

**Files:**
- Modify: `src/background/index.ts`

**Interfaces:**
- Consumes: `TrackingEngine`, `ClassifierEngine`, `CoachingEngine`, `ScoringEngine`, `NotificationManager` from same directory
- Produces: wired service worker that initialises all engines on `chrome.runtime.onInstalled` and `chrome.alarms.onAlarm`

- [ ] **Step 1: Write `src/background/index.ts`**

```ts
import { TrackingEngine } from './TrackingEngine'
import { ClassifierEngine } from './ClassifierEngine'
import { CoachingEngine } from './CoachingEngine'
import { ScoringEngine } from './ScoringEngine'
import { NotificationManager } from './NotificationManager'
import { updateSettings } from '../shared/StorageManager'

const tracking = new TrackingEngine()
const classifier = new ClassifierEngine()
const coaching = new CoachingEngine()
const scoring = new ScoringEngine()
const notifications = new NotificationManager()

chrome.runtime.onInstalled.addListener(() => {
  tracking.init()
  classifier.init()
  coaching.init()

  // Daily summary alarm
  chrome.alarms.create('dailySummary', {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60,
  })

  // Idle detection threshold: 5 minutes
  chrome.idle.setDetectionInterval(300)

  // Side panel open on action click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
})

// Re-attach listeners on service worker restart
tracking.init()
classifier.init()
coaching.init()

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'coachingTick') {
    const message = await coaching.evaluateRules()
    if (message) notifications.deliver(message)
    const scores = await scoring.computeAndStore()
    chrome.runtime.sendMessage({ type: 'SCORE_UPDATE', payload: scores }).catch(() => {})
  }

  if (alarm.name === 'classifyBatch') {
    await classifier.runBatch()
  }

  if (alarm.name === 'dailySummary') {
    await scoring.computeAndStore()
  }
})

// Break detection via idle
chrome.idle.onStateChanged.addListener(async state => {
  if (state === 'idle') {
    const now = new Date()
    const hour = now.getHours()
    if (hour >= 6 && hour < 23) {
      const { todaysSummary } = await import('../shared/StorageManager').then(m => m.getSettings())
      if (todaysSummary) {
        await import('../shared/StorageManager').then(m =>
          m.updateSettings({ todaysSummary: { ...todaysSummary, breaks: todaysSummary.breaks + 1 } })
        )
      }
    }
  }
})

function getNextMidnight(): number {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 1, 0, 0)
  return tomorrow.getTime()
}
```

- [ ] **Step 2: Build and verify no TypeScript errors**

```bash
npm run build
```
Expected: build succeeds, `dist/background.js` exists.

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: wire background service worker — all engines initialised, alarms connected"
```

---

### Task 12: activityMonitor Content Script

**Files:**
- Modify: `src/content/activityMonitor.ts`
- Create: `src/content/activityMonitor.test.ts`

**Interfaces:**
- Consumes: `ExtensionMessage` from `../shared/types`; `sendMessage` from `../shared/messaging`
- Produces: content script that sends `ACTIVITY_SIGNAL` every 30 seconds

- [ ] **Step 1: Write failing test**

```ts
// src/content/activityMonitor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('activityMonitor', () => {
  it('sends ACTIVITY_SIGNAL after 30 seconds', async () => {
    await import('./activityMonitor')
    vi.advanceTimersByTime(30_000)
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ACTIVITY_SIGNAL' })
    )
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — module not found or signal not sent.

- [ ] **Step 3: Write `src/content/activityMonitor.ts`**

```ts
import { sendMessage } from '../shared/messaging'

let scrollIntensity = 0
let videoPlaying = false

document.addEventListener('wheel', e => {
  scrollIntensity = Math.min(10, scrollIntensity + Math.abs(e.deltaY) / 100)
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scrollIntensity = 0
})

const videos = document.querySelectorAll('video')
videos.forEach(v => {
  v.addEventListener('play', () => { videoPlaying = true })
  v.addEventListener('pause', () => { videoPlaying = false })
})

// Also observe dynamically added videos
const observer = new MutationObserver(() => {
  document.querySelectorAll('video').forEach(v => {
    v.addEventListener('play', () => { videoPlaying = true })
    v.addEventListener('pause', () => { videoPlaying = false })
  })
})
observer.observe(document.body, { childList: true, subtree: true })

setInterval(() => {
  const hour = new Date().getHours()
  sendMessage({
    type: 'ACTIVITY_SIGNAL',
    payload: {
      scrollIntensity: Math.round(scrollIntensity),
      videoPlaying,
      hasFocus: !document.hidden,
      timestamp: Date.now(),
    },
  })
  scrollIntensity = Math.max(0, scrollIntensity - 1) // decay
}, 30_000)
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `30 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/content/activityMonitor.ts src/content/activityMonitor.test.ts
git commit -m "feat: add activityMonitor content script — scroll, video, focus signals"
```

---

### Task 13: shortVideoDetector Content Script

**Files:**
- Modify: `src/content/shortVideoDetector.ts`
- Create: `src/content/shortVideoDetector.test.ts`

**Interfaces:**
- Produces: content script that detects YouTube Shorts / TikTok / Instagram Reels / Facebook Reels and sends `SHORT_WATCHED` messages

- [ ] **Step 1: Write failing tests**

```ts
// src/content/shortVideoDetector.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'
import { detectYouTubeShorts, detectTikTok } from './shortVideoDetector'

beforeEach(() => vi.clearAllMocks())

describe('detectYouTubeShorts', () => {
  it('sends SHORT_WATCHED when URL contains /shorts/', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/shorts/abc123', pathname: '/shorts/abc123' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHORT_WATCHED',
      payload: expect.objectContaining({ platform: 'youtube_shorts', count: 1 }),
    })
  })

  it('does not send when URL is not /shorts/', () => {
    Object.defineProperty(window, 'location', {
      value: { href: 'https://www.youtube.com/watch?v=abc', pathname: '/watch' },
      writable: true,
    })
    detectYouTubeShorts()
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Write `src/content/shortVideoDetector.ts`**

```ts
import { sendMessage } from '../shared/messaging'
import type { ShortVideoPlatform } from '../shared/types'

let sessionStart = Date.now()

function fireShortWatched(platform: ShortVideoPlatform): void {
  sendMessage({
    type: 'SHORT_WATCHED',
    payload: { platform, count: 1, duration: Math.round((Date.now() - sessionStart) / 1000) },
  })
  sessionStart = Date.now()
}

export function detectYouTubeShorts(): void {
  if (window.location.pathname.startsWith('/shorts/')) {
    fireShortWatched('youtube_shorts')
  }
}

export function detectTikTok(): void {
  fireShortWatched('tiktok')
}

// YouTube: listen for pushState navigation
const originalPushState = history.pushState.bind(history)
history.pushState = function (...args) {
  originalPushState(...args)
  setTimeout(detectYouTubeShorts, 300)
}
window.addEventListener('popstate', () => setTimeout(detectYouTubeShorts, 300))
detectYouTubeShorts()

// TikTok: observe video container for new videos
if (window.location.hostname.includes('tiktok.com')) {
  const observer = new MutationObserver(() => detectTikTok())
  const container = document.querySelector('[class*="DivVideoFeedV2"]') ?? document.body
  observer.observe(container, { childList: true })
}

// Instagram Reels
if (window.location.hostname.includes('instagram.com')) {
  const observer = new MutationObserver(() => {
    if (window.location.pathname.startsWith('/reels')) {
      fireShortWatched('instagram_reels')
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

// Facebook Reels
if (window.location.hostname.includes('facebook.com')) {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if ((node as Element)?.querySelector?.('[aria-label*="Reel"]')) {
          fireShortWatched('facebook_reels')
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test
```
Expected: `32 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/content/shortVideoDetector.ts src/content/shortVideoDetector.test.ts
git commit -m "feat: add shortVideoDetector content script for YouTube Shorts, TikTok, Reels"
```

---

### Task 14: mindfulOverlay Content Script

**Files:**
- Modify: `src/content/mindfulOverlay.ts`

**Interfaces:**
- Consumes: `SHOW_MINDFUL_CHECKIN` message from background; sends `COACHING_RESPONSE` on user action
- Produces: Shadow DOM card rendered in bottom-center of page

- [ ] **Step 1: Write `src/content/mindfulOverlay.ts`**

(No unit test — Shadow DOM rendering requires a browser environment; tested via manual QA in Task 20.)

```ts
import { onMessage, sendMessage } from '../shared/messaging'

const OVERLAY_STYLES = `
  :host { all: initial; }
  .overlay {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; font-family: system-ui, sans-serif;
    background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 20px 24px; width: 360px; color: #f1f5f9;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: slideUp 0.3s ease;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } }
  .title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
  .message { font-size: 15px; line-height: 1.5; margin-bottom: 12px; }
  .stats { font-size: 13px; color: #64748b; margin-bottom: 16px; }
  .moods { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .mood-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 6px 12px; font-size: 13px; color: #cbd5e1; cursor: pointer; }
  .mood-btn:hover { background: rgba(255,255,255,0.15); }
  .actions { display: flex; gap: 8px; }
  .btn { flex: 1; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: rgba(255,255,255,0.1); color: #cbd5e1; }
  .btn:hover { opacity: 0.85; }
  .close { position: absolute; top: 12px; right: 14px; background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; }
`

function createOverlay(message: string, stats: string): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Mindful Check-in</div>
    <div class="message">${message}</div>
    ${stats ? `<div class="stats">${stats}</div>` : ''}
    <div class="moods">
      <button class="mood-btn" data-mood="energized">😊 Energized</button>
      <button class="mood-btn" data-mood="fine">😐 Fine</button>
      <button class="mood-btn" data-mood="tired">😴 Tired</button>
      <button class="mood-btn" data-mood="just_scrolling">😵 Just scrolling</button>
    </div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="continue">Continue</button>
      <button class="btn btn-primary" data-action="take_break">Take a Break</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const dismiss = (response: 'continue' | 'take_break' | 'dismissed', mood: string | null = null) => {
    sendMessage({ type: 'COACHING_RESPONSE', payload: { response, mood } })
    host.remove()
  }

  card.querySelector('.close')!.addEventListener('click', () => dismiss('dismissed'))
  card.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const mood = (e.currentTarget as HTMLElement).dataset.mood ?? null
      card.querySelectorAll('.mood-btn').forEach(b => (b as HTMLElement).style.background = 'rgba(255,255,255,0.07)')
      ;(e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.4)'
    })
  })
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action as 'continue' | 'take_break'
      const activeMood = card.querySelector('.mood-btn[style*="0.4"]') as HTMLElement | null
      dismiss(action, activeMood?.dataset.mood ?? null)
    })
  })

  return host
}

onMessage(msg => {
  if (msg.type === 'SHOW_MINDFUL_CHECKIN') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createOverlay(msg.payload.message, msg.payload.stats)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})
```

- [ ] **Step 2: Build — verify no TypeScript errors**

```bash
npm run build
```
Expected: build succeeds, `dist/mindfulOverlay.js` exists.

- [ ] **Step 3: Commit**

```bash
git add src/content/mindfulOverlay.ts
git commit -m "feat: add mindfulOverlay Shadow DOM check-in card with mood selection and response"
```

---

### Task 15: Shared React Hooks

**Files:**
- Create: `src/shared/hooks/useStorage.ts`
- Create: `src/shared/hooks/useScores.ts`
- Create: `src/shared/hooks/useStorage.test.ts`

**Interfaces:**
- Consumes: `ExtensionSettings`, `Scores` from `../../types`; `getSettings` from `../../StorageManager`
- Produces: `useSettings(): ExtensionSettings | null`, `useScores(): Scores | null`

- [ ] **Step 1: Write failing tests**

```tsx
// src/shared/hooks/useStorage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSettings } from './useStorage'
import { DEFAULT_SETTINGS } from '../../shared/StorageManager'

vi.mock('../../shared/StorageManager', () => ({
  DEFAULT_SETTINGS: { coachingEnabled: true, mentorPersonality: 'wise', selectedModel: 'openai/gpt-4o-mini',
    theme: 'system', coachingFrequency: 'moderate', coachingHours: { start: 9, end: 22 },
    excludedDomains: [], privateModeActive: false, eyeHealthReminders: true,
    lastHealthScore: 0, todaysSummary: null, achievements: [], ruleLastFired: {},
    openrouterApiKey: '' },
  getSettings: vi.fn().mockResolvedValue({ coachingEnabled: true, mentorPersonality: 'wise' }),
}))

describe('useSettings', () => {
  it('returns settings after async load', async () => {
    const { result } = renderHook(() => useSettings())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current?.coachingEnabled).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './useStorage'`

- [ ] **Step 3: Write `src/shared/hooks/useStorage.ts`**

```ts
import { useState, useEffect } from 'react'
import type { ExtensionSettings } from '../types'
import { getSettings } from '../StorageManager'

export function useSettings(): ExtensionSettings | null {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)
    const listener = () => getSettings().then(setSettings)
    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [])

  return settings
}
```

- [ ] **Step 4: Write `src/shared/hooks/useScores.ts`**

```ts
import { useState, useEffect } from 'react'
import type { Scores } from '../types'
import { onMessage } from '../messaging'

export function useScores(): Scores | null {
  const [scores, setScores] = useState<Scores | null>(null)

  useEffect(() => {
    onMessage(msg => {
      if (msg.type === 'SCORE_UPDATE') setScores(msg.payload)
    })
  }, [])

  return scores
}
```

- [ ] **Step 5: Run — verify pass**

```bash
npm test
```
Expected: `33 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/hooks/useStorage.ts src/shared/hooks/useScores.ts src/shared/hooks/useStorage.test.ts
git commit -m "feat: add useSettings and useScores React hooks"
```

---

### Task 16: Popup UI

**Files:**
- Create: `src/popup/App.tsx`
- Create: `src/popup/main.tsx`
- Create: `src/popup/components/ScoreRing.tsx`
- Create: `src/popup/components/ScreenTimeBar.tsx`
- Create: `src/popup/components/CoachingCard.tsx`
- Create: `src/popup/App.test.tsx`

**Interfaces:**
- Consumes: `useSettings` from `../shared/hooks/useStorage`; `ExtensionSettings`, `DailySummary` from `../shared/types`

- [ ] **Step 1: Write failing test**

```tsx
// src/popup/App.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    todaysSummary: { healthScore: 82, productivityScore: 75, learningScore: 60,
      shortVideoCount: 23, totalTime: 14400, byCategory: {}, topSites: [], breaks: 2,
      lateNightMinutes: 0, shortVideoDuration: 0, date: '2026-06-27' },
    lastHealthScore: 82,
  }),
}))
vi.mock('../shared/hooks/useScores', () => ({ useScores: () => ({ health: 82, productivity: 75, learning: 60 }) }))

describe('Popup App', () => {
  it('renders health score', () => {
    render(<App />)
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('shows short video count', () => {
    render(<App />)
    expect(screen.getByText(/23 Shorts/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL — `Cannot find module './App'`

- [ ] **Step 3: Write `src/popup/components/ScoreRing.tsx`**

```tsx
interface Props { score: number; label: string; color: string; size?: number }

export function ScoreRing({ score, label, color, size = 80 }: Props) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="text-2xl font-bold text-slate-100 -mt-[56px] rotate-90 relative z-10">{score}</span>
      <span className="text-xs text-slate-400 mt-8">{label}</span>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/popup/components/ScreenTimeBar.tsx`**

```tsx
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'
import type { Category, DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

export function ScreenTimeBar({ summary }: Props) {
  const total = summary.totalTime || 1
  const entries = Object.entries(summary.byCategory)
    .filter(([, sec]) => sec > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6) as [Category, number][]

  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {entries.map(([cat, sec]) => (
          <div key={cat} style={{ width: `${(sec / total) * 100}%`, background: CATEGORY_COLORS[cat] }}
            title={`${CATEGORY_LABELS[cat]}: ${Math.round(sec / 60)}m`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {entries.map(([cat, sec]) => (
          <span key={cat} className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
            {CATEGORY_LABELS[cat]} {Math.round(sec / 60)}m
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/popup/components/CoachingCard.tsx`**

```tsx
interface Props { message: string; onDismiss: () => void }

export function CoachingCard({ message, onDismiss }: Props) {
  return (
    <div className="bg-blue-950/60 border border-blue-500/20 rounded-xl p-3">
      <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
      <button onClick={onDismiss} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Dismiss</button>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/popup/App.tsx`**

```tsx
import { useState } from 'react'
import { ScoreRing } from './components/ScoreRing'
import { ScreenTimeBar } from './components/ScreenTimeBar'
import { CoachingCard } from './components/CoachingCard'
import { useSettings } from '../shared/hooks/useStorage'
import { useScores } from '../shared/hooks/useScores'

export function App() {
  const settings = useSettings()
  const scores = useScores()
  const [coachMsg, setCoachMsg] = useState<string | null>(null)

  const summary = settings?.todaysSummary
  const health = scores?.health ?? settings?.lastHealthScore ?? 0
  const productivity = scores?.productivity ?? 0
  const learning = scores?.learning ?? 0

  return (
    <div className="w-[400px] min-h-[400px] bg-slate-900 text-slate-100 p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-blue-400">WiseMind AI</h1>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
        <button onClick={() => chrome.runtime.openOptionsPage()} className="text-slate-500 hover:text-slate-300 text-lg">⚙</button>
      </div>

      {/* Score rings */}
      <div className="flex justify-around">
        <ScoreRing score={health} label="Health" color="#10b981" size={80} />
        <ScoreRing score={productivity} label="Productivity" color="#3b82f6" size={80} />
        <ScoreRing score={learning} label="Learning" color="#8b5cf6" size={80} />
      </div>

      {/* Screen time bar */}
      {summary && <ScreenTimeBar summary={summary} />}

      {/* Short video counter */}
      {summary && summary.shortVideoCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/20 rounded-lg px-3 py-2">
          <span className="text-amber-400 text-lg">📱</span>
          <span className="text-sm text-slate-300">{summary.shortVideoCount} Shorts today</span>
        </div>
      )}

      {/* Coaching card */}
      {coachMsg && <CoachingCard message={coachMsg} onDismiss={() => setCoachMsg(null)} />}

      {/* Quick links */}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => chrome.tabs.create({ url: 'newtab.html' })}
          className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-slate-300">
          Dashboard
        </button>
        <button onClick={() => chrome.sidePanel?.open({ windowId: undefined as any })}
          className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg py-2 text-slate-300">
          AI Coach
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write `src/popup/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../shared/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

Create `src/shared/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Update each UI surface `main.tsx` to import `'../shared/index.css'` (or the relative equivalent).

- [ ] **Step 8: Run tests — verify pass**

```bash
npm test
```
Expected: `35 passed`.

- [ ] **Step 9: Build**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/popup/ src/shared/index.css
git commit -m "feat: build popup UI — score rings, screen time bar, short video counter"
```

---

### Task 17: Side Panel UI (AI Coach Chat)

**Files:**
- Create: `src/sidepanel/App.tsx`
- Create: `src/sidepanel/main.tsx`
- Create: `src/sidepanel/components/ChatThread.tsx`
- Create: `src/sidepanel/components/QuickPrompts.tsx`
- Create: `src/sidepanel/App.test.tsx`

**Interfaces:**
- Consumes: `useSettings` from `../shared/hooks/useStorage`; OpenRouter API via fetch

- [ ] **Step 1: Write failing test**

```tsx
// src/sidepanel/App.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({ openrouterApiKey: 'test-key', selectedModel: 'openai/gpt-4o-mini', mentorPersonality: 'wise', lastHealthScore: 75 }),
}))

describe('SidePanel App', () => {
  it('renders quick prompt chips', () => {
    render(<App />)
    expect(screen.getByText(/How am I doing/i)).toBeInTheDocument()
  })

  it('shows input field', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/Ask your coach/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Write `src/sidepanel/components/ChatThread.tsx`**

```tsx
interface Message { role: 'user' | 'assistant'; content: string }

interface Props { messages: Message[] }

export function ChatThread({ messages }: Props) {
  return (
    <div className="flex flex-col gap-3 py-4 px-3 overflow-y-auto flex-1">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            m.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-200 rounded-bl-sm'
          }`}>
            {m.content}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/sidepanel/components/QuickPrompts.tsx`**

```tsx
const PROMPTS = [
  'How am I doing today?',
  'Am I improving?',
  'Give me a tip',
]

interface Props { onSelect: (prompt: string) => void }

export function QuickPrompts({ onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap px-3 pb-2">
      {PROMPTS.map(p => (
        <button key={p} onClick={() => onSelect(p)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-3 py-1.5 border border-slate-700">
          {p}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/sidepanel/App.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react'
import { ChatThread } from './components/ChatThread'
import { QuickPrompts } from './components/QuickPrompts'
import { useSettings } from '../shared/hooks/useStorage'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const PERSONALITY_INTRO: Record<string, string> = {
  wise: "I'm your Wise Mentor — calm, thoughtful, here to guide you.",
  friendly: "Hey! I'm your Friendly Coach — let's have a great day!",
  coach: "I'm your Tough Coach. No excuses. Let's get it done.",
  mindful: "I'm your Mindfulness Guide. Breathe. Let's reflect together.",
  funny: "I'm your Funny Companion 😄 — wellness with a side of laughs!",
}

interface Message { role: 'user' | 'assistant'; content: string }

export function App() {
  const settings = useSettings()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (settings) {
      setMessages([{ role: 'assistant', content: PERSONALITY_INTRO[settings.mentorPersonality] ?? PERSONALITY_INTRO.wise }])
    }
  }, [settings?.mentorPersonality])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || !settings?.openrouterApiKey) return
    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://wisemind-ai',
          'X-Title': 'WiseMind AI',
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [
            { role: 'system', content: `You are a digital wellness coach. Health score today: ${settings.lastHealthScore}/100. Be concise and supportive.` },
            ...next.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not respond right now.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check your API key in settings.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-sm">🧠</div>
        <div>
          <p className="text-sm font-semibold">WiseMind Coach</p>
          <p className="text-xs text-slate-500">Health: {settings?.lastHealthScore ?? '—'}/100</p>
        </div>
      </div>

      <ChatThread messages={messages} />
      <div ref={bottomRef} />

      {!settings?.openrouterApiKey && (
        <div className="mx-3 mb-2 text-xs text-amber-400 bg-amber-950/40 rounded-lg px-3 py-2">
          Add your OpenRouter API key in Settings to enable AI coaching.
        </div>
      )}

      <QuickPrompts onSelect={sendMessage} />

      <div className="flex gap-2 px-3 pb-4">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask your coach anything..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium">
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/sidepanel/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../shared/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Step 7: Run tests — verify pass**

```bash
npm test
```
Expected: `37 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/sidepanel/
git commit -m "feat: build side panel AI coach chat with quick prompts and OpenRouter streaming"
```

---

### Task 18: New Tab Dashboard

**Files:**
- Create: `src/newtab/App.tsx`, `src/newtab/main.tsx`
- Create: `src/newtab/components/ScoreCards.tsx`
- Create: `src/newtab/components/Timeline.tsx`
- Create: `src/newtab/components/ShortVideoReport.tsx`
- Create: `src/newtab/components/GoalsProgress.tsx`
- Create: `src/newtab/components/Achievements.tsx`
- Create: `src/newtab/components/WeeklyReport.tsx`
- Create: `src/newtab/components/Recommendations.tsx`
- Create: `src/newtab/App.test.tsx`

**Interfaces:**
- Consumes: `useSettings` from `../shared/hooks/useStorage`; `getLastNDailySummaries`, `getVisitsByDateRange` from `../shared/db`; `getTodayRange` from `../shared/constants`

- [ ] **Step 1: Write failing test**

```tsx
// src/newtab/App.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    lastHealthScore: 78, todaysSummary: {
      healthScore: 78, productivityScore: 65, learningScore: 55,
      shortVideoCount: 12, shortVideoDuration: 720, totalTime: 18000,
      byCategory: { programming: 5400, entertainment: 3600 },
      topSites: [{ domain: 'github.com', duration: 5400 }],
      breaks: 3, lateNightMinutes: 0, date: '2026-06-27',
    },
    achievements: [],
    mentorPersonality: 'wise',
    openrouterApiKey: 'key',
    selectedModel: 'openai/gpt-4o-mini',
  }),
}))
vi.mock('../shared/db', () => ({
  getLastNDailySummaries: vi.fn().mockResolvedValue([]),
  getVisitsByDateRange: vi.fn().mockResolvedValue([]),
}))

describe('NewTab App', () => {
  it('renders health score card', () => {
    render(<App />)
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('renders short video count', () => {
    render(<App />)
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Write `src/newtab/components/ScoreCards.tsx`**

```tsx
import { ScoreRing } from '../../popup/components/ScoreRing'

interface Props { health: number; productivity: number; learning: number }

export function ScoreCards({ health, productivity, learning }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { score: health, label: 'Health', color: '#10b981' },
        { score: productivity, label: 'Productivity', color: '#3b82f6' },
        { score: learning, label: 'Learning', color: '#8b5cf6' },
      ].map(({ score, label, color }) => (
        <div key={label} className="bg-slate-800/60 rounded-2xl p-6 flex flex-col items-center border border-slate-700/50">
          <ScoreRing score={score} label={label} color={color} size={100} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/newtab/components/Timeline.tsx`**

```tsx
import type { Visit } from '../../shared/types'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../shared/constants'

interface Props { visits: Visit[] }

export function Timeline({ visits }: Props) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const byHour: Record<number, Visit[]> = {}
  for (const v of visits) {
    const h = new Date(v.startTime).getHours()
    byHour[h] = [...(byHour[h] ?? []), v]
  }

  const maxSec = Math.max(...Object.values(byHour).map(vs => vs.reduce((s, v) => s + v.duration, 0)), 1)

  return (
    <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Today's Timeline</h3>
      <div className="flex items-end gap-px h-24 overflow-x-auto">
        {hours.map(h => {
          const hvs = byHour[h] ?? []
          const total = hvs.reduce((s, v) => s + v.duration, 0)
          const heightPct = (total / maxSec) * 100
          const topCategory = hvs.sort((a, b) => b.duration - a.duration)[0]?.category

          return (
            <div key={h} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 group relative">
              <div className="w-full rounded-sm" style={{ height: `${heightPct}%`, minHeight: total > 0 ? 2 : 0, background: topCategory ? CATEGORY_COLORS[topCategory] : 'transparent' }} />
              {total > 0 && (
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 whitespace-nowrap z-10">
                  {h}:00 — {topCategory ? CATEGORY_LABELS[topCategory] : ''} {Math.round(total / 60)}m
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-1">
        <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/newtab/components/ShortVideoReport.tsx`**

```tsx
import type { DailySummary } from '../../shared/types'

interface Props { summary: DailySummary }

export function ShortVideoReport({ summary }: Props) {
  const minutes = Math.round(summary.shortVideoDuration / 60)
  return (
    <div className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-amber-400 mb-3">📱 Short Videos</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-3xl font-bold text-slate-100">{summary.shortVideoCount}</p>
          <p className="text-xs text-slate-500 mt-1">videos watched</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-100">{minutes}m</p>
          <p className="text-xs text-slate-500 mt-1">total duration</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/newtab/components/Achievements.tsx`**

```tsx
import type { Achievement } from '../../shared/types'

const ALL_ACHIEVEMENTS = [
  { id: 'deep_learner', label: 'Deep Learner', icon: '📚', desc: 'Learning score ≥ 90' },
  { id: 'seven_day_focus', label: 'Seven-day Focus', icon: '🎯', desc: 'Productivity ≥ 75 for 7 days' },
  { id: 'healthy_week', label: 'Healthy Week', icon: '💚', desc: 'Health ≥ 80 for 7 days' },
  { id: 'eye_care_champion', label: 'Eye Care', icon: '👁', desc: 'All eye reminders for 3 days' },
  { id: 'balanced_day', label: 'Balanced Day', icon: '⚖️', desc: 'All scores ≥ 70' },
  { id: 'digital_minimalist', label: 'Minimalist', icon: '🧘', desc: 'Entertainment < 30m for 5 days' },
  { id: 'learning_streak', label: 'Learning Streak', icon: '🔥', desc: 'Learning every day for 7 days' },
]

interface Props { achievements: Achievement[] }

export function Achievements({ achievements }: Props) {
  const unlockedIds = new Set(achievements.map(a => a.id))
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Achievements</h3>
      <div className="grid grid-cols-4 gap-3">
        {ALL_ACHIEVEMENTS.map(a => (
          <div key={a.id} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${unlockedIds.has(a.id) ? 'bg-blue-950/60 border border-blue-500/30' : 'opacity-30'}`}
            title={a.desc}>
            <span className="text-2xl">{a.icon}</span>
            <span className="text-xs text-slate-400 text-center leading-tight">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Write `src/newtab/components/GoalsProgress.tsx`**

```tsx
import type { Goal, DailySummary } from '../../shared/types'
import { CATEGORY_LABELS } from '../../shared/constants'

interface Props { goals: Goal[]; summary: DailySummary }

export function GoalsProgress({ goals, summary }: Props) {
  if (goals.length === 0) return null

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Goals</h3>
      <div className="space-y-4">
        {goals.map(g => {
          const cat = g.target as keyof typeof summary.byCategory
          const usedMin = Math.round((summary.byCategory[cat] ?? 0) / 60)
          const limit = g.dailyLimitMinutes ?? 120
          const pct = Math.min(100, Math.round((usedMin / limit) * 100))
          const over = usedMin > limit

          return (
            <div key={g.id}>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{CATEGORY_LABELS[cat] ?? g.target}</span>
                <span className={over ? 'text-red-400' : 'text-slate-400'}>{usedMin}m / {limit}m</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Write `src/newtab/components/WeeklyReport.tsx`**

```tsx
import type { DailySummary } from '../../shared/types'

interface Props { summaries: DailySummary[] }

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 100, h = 32
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  )
}

export function WeeklyReport({ summaries }: Props) {
  if (summaries.length < 2) return null
  const sorted = [...summaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)

  const thisWeekLearn = sorted.slice(-7).reduce((s, d) => s + (d.byCategory as any)['learning'] ?? 0, 0)
  const lastWeekLearn = sorted.slice(-14, -7).reduce((s, d) => s + (d.byCategory as any)['learning'] ?? 0, 0)
  const learningDiff = lastWeekLearn > 0 ? Math.round(((thisWeekLearn - lastWeekLearn) / lastWeekLearn) * 100) : 0

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Weekly Trends</h3>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Learning', color: '#8b5cf6', values: sorted.map(d => d.learningScore) },
          { label: 'Productivity', color: '#3b82f6', values: sorted.map(d => d.productivityScore) },
          { label: 'Health', color: '#10b981', values: sorted.map(d => d.healthScore) },
        ].map(({ label, color, values }) => (
          <div key={label} className="bg-slate-900/40 rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <Sparkline values={values} color={color} />
            <p className="text-lg font-bold mt-1" style={{ color }}>
              {Math.round(values.reduce((a, b) => a + b, 0) / values.length)}
            </p>
          </div>
        ))}
      </div>
      {learningDiff !== 0 && (
        <p className="text-xs mt-3 text-slate-400">
          Learning {learningDiff > 0 ? '↑' : '↓'}{Math.abs(learningDiff)}% vs last week
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 9: Write `src/newtab/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { ScoreCards } from './components/ScoreCards'
import { Timeline } from './components/Timeline'
import { ShortVideoReport } from './components/ShortVideoReport'
import { GoalsProgress } from './components/GoalsProgress'
import { Achievements } from './components/Achievements'
import { WeeklyReport } from './components/WeeklyReport'
import { getLastNDailySummaries, getVisitsByDateRange, getActiveGoals } from '../shared/db'
import { getTodayRange } from '../shared/constants'
import type { Visit, DailySummary, Goal } from '../shared/types'

export function App() {
  const settings = useSettings()
  const [visits, setVisits] = useState<Visit[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<DailySummary[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  useEffect(() => {
    const { start, end } = getTodayRange()
    Promise.all([
      getVisitsByDateRange(start, end).then(setVisits),
      getLastNDailySummaries(14).then(setWeeklySummaries),
      getActiveGoals().then(setGoals),
    ])
  }, [])

  const summary = settings?.todaysSummary
  if (!summary) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500 text-sm">
      Tracking starts as you browse. Open a website to begin.
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">WiseMind AI</h1>
          <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <ScoreCards health={summary.healthScore} productivity={summary.productivityScore} learning={summary.learningScore} />
        <Timeline visits={visits} />
        {summary.shortVideoCount > 0 && <ShortVideoReport summary={summary} />}
        <GoalsProgress goals={goals} summary={summary} />
        <WeeklyReport summaries={weeklySummaries} />
        <Achievements achievements={settings?.achievements ?? []} />
      </div>
    </div>
  )
}
```

- [ ] **Step 10: Write `src/newtab/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../shared/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Step 11: Run tests — verify pass**

```bash
npm test
```
Expected: `39 passed`.

- [ ] **Step 12: Build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 13: Commit**

```bash
git add src/newtab/
git commit -m "feat: build new tab dashboard — scores, timeline, short video report, achievements, weekly trends"
```

---

### Task 19: Settings Page

**Files:**
- Create: `src/settings/App.tsx`
- Create: `src/settings/main.tsx`
- Create: `src/settings/App.test.tsx`

**Interfaces:**
- Consumes: `useSettings` from `../shared/hooks/useStorage`; `updateSettings` from `../shared/StorageManager`; `addGoal` from `../shared/db`

- [ ] **Step 1: Write failing test**

```tsx
// src/settings/App.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from './App'

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    openrouterApiKey: '', selectedModel: 'openai/gpt-4o-mini',
    mentorPersonality: 'wise', theme: 'system', coachingEnabled: true,
    coachingFrequency: 'moderate', coachingHours: { start: 9, end: 22 },
    excludedDomains: [], privateModeActive: false, eyeHealthReminders: true,
    lastHealthScore: 0, todaysSummary: null, achievements: [], ruleLastFired: {},
  }),
}))
vi.mock('../shared/StorageManager', () => ({ updateSettings: vi.fn() }))

describe('Settings App', () => {
  it('renders API key input', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/sk-or-/i)).toBeInTheDocument()
  })

  it('renders personality selector', () => {
    render(<App />)
    expect(screen.getByText('Wise Mentor')).toBeInTheDocument()
  })

  it('calls updateSettings when API key saved', () => {
    const { updateSettings } = require('../shared/StorageManager')
    render(<App />)
    const input = screen.getByPlaceholderText(/sk-or-/i)
    fireEvent.change(input, { target: { value: 'sk-or-test' } })
    fireEvent.click(screen.getByText('Save'))
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ openrouterApiKey: 'sk-or-test' }))
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npm test
```
Expected: FAIL.

- [ ] **Step 3: Write `src/settings/App.tsx`**

```tsx
import { useState } from 'react'
import { useSettings } from '../shared/hooks/useStorage'
import { updateSettings } from '../shared/StorageManager'
import type { MentorPersonality, Theme } from '../shared/types'

const PERSONALITIES: Array<{ id: MentorPersonality; label: string; desc: string }> = [
  { id: 'wise', label: 'Wise Mentor', desc: 'Calm, thoughtful, reflective.' },
  { id: 'friendly', label: 'Friendly Friend', desc: 'Relaxed, positive, casual.' },
  { id: 'coach', label: 'Tough Coach', desc: 'Disciplined, direct, no excuses.' },
  { id: 'mindful', label: 'Mindfulness Guide', desc: 'Peaceful, focused on breathing.' },
  { id: 'funny', label: 'Funny Companion', desc: 'Playful reminders with humour.' },
]

const MODELS = [
  'openai/gpt-4o-mini', 'openai/gpt-4o',
  'anthropic/claude-haiku-4-5', 'anthropic/claude-sonnet-4-5',
  'google/gemini-flash-1.5',
]

export function App() {
  const settings = useSettings()
  const [apiKey, setApiKey] = useState(settings?.openrouterApiKey ?? '')
  const [saved, setSaved] = useState(false)

  if (!settings) return <div className="min-h-screen bg-slate-900" />

  async function save() {
    await updateSettings({ openrouterApiKey: apiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function clearData() {
    if (!confirm('Delete all browsing history and scores? This cannot be undone.')) return
    const { getDB } = await import('../shared/db')
    const db = await getDB()
    await db.clear('visits')
    await db.clear('shortVideos')
    await db.clear('coachingEvents')
    await db.clear('dailySummaries')
    await updateSettings({ todaysSummary: null, lastHealthScore: 0, achievements: [], ruleLastFired: {} })
  }

  async function exportData() {
    const { getDB } = await import('../shared/db')
    const db = await getDB()
    const data = {
      visits: await db.getAll('visits'),
      shortVideos: await db.getAll('shortVideos'),
      dailySummaries: await db.getAll('dailySummaries'),
      goals: await db.getAll('goals'),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'wisemind-data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Settings</h1>

        {/* API Configuration */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">API Configuration</h2>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">OpenRouter API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100 outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Model</label>
            <select value={settings.selectedModel}
              onChange={e => updateSettings({ selectedModel: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-100">
              {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button onClick={save}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-6 py-2 text-sm font-medium">
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </section>

        {/* Mentor Personality */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Mentor Personality</h2>
          <div className="grid grid-cols-1 gap-2">
            {PERSONALITIES.map(p => (
              <button key={p.id}
                onClick={() => updateSettings({ mentorPersonality: p.id })}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  settings.mentorPersonality === p.id
                    ? 'border-blue-500 bg-blue-950/60'
                    : 'border-slate-700 hover:border-slate-600'
                }`}>
                <p className="text-sm font-medium text-slate-200">{p.label}</p>
                <p className="text-xs text-slate-500">{p.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Coaching Controls */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Coaching Controls</h2>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Enable Coaching</span>
            <input type="checkbox" checked={settings.coachingEnabled}
              onChange={e => updateSettings({ coachingEnabled: e.target.checked })}
              className="w-5 h-5 accent-blue-500" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Eye Health Reminders</span>
            <input type="checkbox" checked={settings.eyeHealthReminders}
              onChange={e => updateSettings({ eyeHealthReminders: e.target.checked })}
              className="w-5 h-5 accent-blue-500" />
          </label>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Coaching Hours ({settings.coachingHours.start}:00 – {settings.coachingHours.end}:00)</label>
            <div className="flex gap-3">
              {(['start', 'end'] as const).map(k => (
                <input key={k} type="number" min={0} max={23}
                  value={settings.coachingHours[k]}
                  onChange={e => updateSettings({ coachingHours: { ...settings.coachingHours, [k]: Number(e.target.value) } })}
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Privacy & Data</h2>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300">Private Mode</p>
              <p className="text-xs text-slate-500">Pauses all tracking and AI calls</p>
            </div>
            <input type="checkbox" checked={settings.privateModeActive}
              onChange={e => updateSettings({ privateModeActive: e.target.checked })}
              className="w-5 h-5 accent-blue-500" />
          </label>
          <div className="flex gap-3">
            <button onClick={exportData}
              className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-lg py-2 text-sm text-slate-300">
              Export Data
            </button>
            <button onClick={clearData}
              className="flex-1 bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 rounded-lg py-2 text-sm text-red-400">
              Delete All Data
            </button>
          </div>
        </section>

        {/* Theme */}
        <section className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Theme</h2>
          <div className="flex gap-2">
            {(['dark', 'light', 'system'] as Theme[]).map(t => (
              <button key={t} onClick={() => updateSettings({ theme: t })}
                className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                  settings.theme === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/settings/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import '../shared/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

- [ ] **Step 5: Register settings page as options page in manifest**

Add to `public/manifest.json`:
```json
"options_page": "settings.html"
```

- [ ] **Step 6: Run tests — verify pass**

```bash
npm test
```
Expected: `42 passed`.

- [ ] **Step 7: Final build**

```bash
npm run build
```
Expected: all entry points compiled successfully in `dist/`.

- [ ] **Step 8: Commit**

```bash
git add src/settings/ public/manifest.json
git commit -m "feat: build settings page — API key, personality, coaching controls, privacy, data export"
```

---

### Task 20: Load Extension and Verify End-to-End

No automated tests — manual QA steps to verify the installed extension works.

- [ ] **Step 1: Build final bundle**

```bash
npm run build
```

- [ ] **Step 2: Load unpacked extension in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `dist/` folder

Expected: WiseMind AI appears with the correct icon and no errors shown.

- [ ] **Step 3: Verify Popup**

Click the extension icon. Confirm:
- Score rings render (all showing 0 initially, no crashes)
- "Dashboard" and "AI Coach" quick links are visible

- [ ] **Step 4: Add OpenRouter API key**

Right-click extension icon → Options (or click Settings gear in popup). Enter your OpenRouter API key and click Save.

- [ ] **Step 5: Browse for 2+ minutes across multiple sites**

Visit GitHub, YouTube, a news site. Return to popup. Confirm:
- Screen time bar shows categories
- Health/Productivity scores have updated

- [ ] **Step 6: Verify new tab dashboard**

Open a new tab. Confirm:
- Score cards visible
- Timeline shows bars for the sites visited
- Top sites section populated

- [ ] **Step 7: Verify side panel**

Click "AI Coach" in popup. Confirm:
- Chat panel opens
- Sending "How am I doing today?" returns an AI response

- [ ] **Step 8: Verify short video detection**

Visit `youtube.com/shorts/` and scroll through 3–4 Shorts. Return to popup. Confirm:
- "Shorts today" counter shows > 0

- [ ] **Step 9: Trigger mindful overlay**

Either wait for a coaching alarm (up to 5 min) or manually test by calling `chrome.runtime.sendMessage({ type: 'SHOW_MINDFUL_CHECKIN', payload: { message: 'Test check-in', stats: '5 Shorts' } })` in the DevTools console of any tab. Confirm:
- The dark card appears at the bottom of the page
- Mood buttons and action buttons work
- Dismissing removes the card

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "feat: complete WiseMind AI v1 — all surfaces working, end-to-end verified"
```

---

## Self-Review: Spec Coverage

| Spec Requirement | Covered by Task |
|-----------------|----------------|
| Screen time tracking (total, daily) | Task 6, 8 |
| AI website classification | Task 7 |
| Website categories (14 types) | Task 2 |
| AI Short video detection (Shorts/Reels/TikTok/Facebook) | Task 13 |
| Mindful AI interruptions (check-in card) | Task 14 |
| AI mentor personalities (5 types) | Task 9, 17, 19 |
| AI conversation (side panel chat) | Task 17 |
| Health score (5 dimensions) | Task 8 |
| Productivity score | Task 8 |
| Learning score | Task 8 |
| Daily timeline | Task 18 |
| Weekly reports | Task 18 |
| Goal system | Task 19 (settings), Task 18 (display) |
| Gamification / achievements | Task 8 (evaluation), Task 18 (display) |
| Privacy (private mode, exclude, export, delete) | Task 19 |
| Eye health (20-20-20) | Task 9 (rule), Task 10 (deliver) |
| Sleep coach | Task 9 (rule) |
| Popup UI | Task 16 |
| New tab dashboard | Task 18 |
| Side panel coach | Task 17 |
| Silent start (no onboarding) | Task 11 (tracking starts on install) |
| OpenRouter API (user key) | Task 7, 9, 17 |
| Inspirational daily message | Task 17 (side panel intro) — **gap: not on new tab hero** |

**Gap found:** Daily inspirational message on new tab hero (spec section 7). Adding to new tab App: after scores are loaded, fire one OpenRouter call per day to generate and cache a motivational message in `chrome.storage.local`. Cached in `chrome.storage.local` under `todayInspiration` — generated once at first new tab open each day.

Add to `src/newtab/App.tsx` `useEffect`:
```tsx
// After settings loads, generate daily inspiration if not yet generated today
useEffect(() => {
  if (!settings?.openrouterApiKey) return
  const today = new Date().toISOString().split('T')[0]
  chrome.storage.local.get({ todayInspiration: null, inspirationDate: '' }, async (res) => {
    if (res.inspirationDate === today) {
      setInspiration(res.todayInspiration)
      return
    }
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.openrouterApiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'chrome-extension://wisemind-ai', 'X-Title': 'WiseMind AI' },
      body: JSON.stringify({ model: settings.selectedModel, messages: [
        { role: 'system', content: `You are a ${settings.mentorPersonality} wellness coach. Generate one short (1-2 sentences) personalized daily inspiration message. Health score: ${settings.lastHealthScore}/100.` },
        { role: 'user', content: 'Give me today\'s inspiration.' },
      ]}),
    }).catch(() => null)
    if (!r?.ok) return
    const d = await r.json()
    const msg = d.choices?.[0]?.message?.content?.trim()
    if (msg) {
      setInspiration(msg)
      chrome.storage.local.set({ todayInspiration: msg, inspirationDate: today })
    }
  })
}, [settings?.openrouterApiKey])
```
Add `const [inspiration, setInspiration] = useState<string | null>(null)` and render it in the hero section.

