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
