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
  breakIntervalMinutes: number   // minutes of continuous use before a break prompt
  windDownEnabled: boolean        // evening wind-down reminders
  windDownTintEnabled: boolean    // opt-in warm screen tint at night
  windDownStart: number           // wind-down start, minutes since midnight
  windDownBedtime: number         // target bedtime, minutes since midnight
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
  | { type: 'GET_SETTINGS' }
  | { type: 'ACHIEVEMENT_UNLOCKED'; payload: { ids: string[] } }
  | { type: 'SHOW_BREAK_PROMPT'; payload: { title: string; instruction: string; durationSec: number } }
  | { type: 'BREAK_RESPONSE'; payload: { response: 'completed' | 'skipped' | 'snoozed' } }
  | { type: 'SHOW_WIND_DOWN'; payload: { message: string } }
  | { type: 'WIND_DOWN_RESPONSE'; payload: { response: 'dismissed' | 'snoozed' } }
