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
  learning: '#c9892f', programming: '#58789f', productivity: '#58789f',
  ai_tools: '#4d7c57', reading: '#4d7c57', entertainment: '#7c5a80',
  gaming: '#b85c38', social_media: '#7c5a80', news: '#8a7a5c', shopping: '#c9892f',
  finance: '#4d7c57', health: '#4d7c57', communication: '#58789f', other: '#a3947a',
}

export const DOMAIN_MAP: Record<string, Category> = {
  // programming / dev
  'github.com': 'programming', 'gitlab.com': 'programming', 'bitbucket.org': 'programming',
  'stackoverflow.com': 'programming', 'stackexchange.com': 'programming',
  'developer.mozilla.org': 'programming', 'codepen.io': 'programming', 'codesandbox.io': 'programming',
  'replit.com': 'programming', 'freecodecamp.org': 'programming', 'w3schools.com': 'programming',
  'geeksforgeeks.org': 'programming', 'hackerrank.com': 'programming', 'codewars.com': 'programming',
  'css-tricks.com': 'programming', 'dev.to': 'programming', 'npmjs.com': 'programming',
  'pypi.org': 'programming', 'devdocs.io': 'programming', 'react.dev': 'programming',
  'nodejs.org': 'programming', 'python.org': 'programming', 'rust-lang.org': 'programming',
  'go.dev': 'programming', 'typescriptlang.org': 'programming', 'tailwindcss.com': 'programming',
  'vercel.com': 'programming', 'netlify.com': 'programming', 'kaggle.com': 'programming',

  // learning
  'leetcode.com': 'learning', 'coursera.org': 'learning', 'udemy.com': 'learning',
  'khanacademy.org': 'learning', 'edx.org': 'learning', 'duolingo.com': 'learning',
  'brilliant.org': 'learning', 'codecademy.com': 'learning', 'pluralsight.com': 'learning',
  'skillshare.com': 'learning', 'udacity.com': 'learning', 'datacamp.com': 'learning',
  'futurelearn.com': 'learning', 'sololearn.com': 'learning', 'ted.com': 'learning',
  'masterclass.com': 'learning', 'quizlet.com': 'learning', 'mit.edu': 'learning',
  'harvard.edu': 'learning', 'stanford.edu': 'learning',

  // reading
  'medium.com': 'reading', 'wikipedia.org': 'reading', 'substack.com': 'reading',
  'arxiv.org': 'reading', 'goodreads.com': 'reading', 'nature.com': 'reading',

  // ai tools
  'chatgpt.com': 'ai_tools', 'claude.ai': 'ai_tools', 'gemini.google.com': 'ai_tools',
  'copilot.microsoft.com': 'ai_tools', 'perplexity.ai': 'ai_tools', 'openrouter.ai': 'ai_tools',
  'huggingface.co': 'ai_tools', 'poe.com': 'ai_tools', 'midjourney.com': 'ai_tools',
  'mistral.ai': 'ai_tools', 'deepseek.com': 'ai_tools', 'you.com': 'ai_tools',

  // productivity / work
  'notion.so': 'productivity', 'docs.google.com': 'productivity', 'sheets.google.com': 'productivity',
  'drive.google.com': 'productivity', 'calendar.google.com': 'productivity', 'trello.com': 'productivity',
  'asana.com': 'productivity', 'figma.com': 'productivity', 'canva.com': 'productivity',
  'airtable.com': 'productivity', 'clickup.com': 'productivity', 'monday.com': 'productivity',
  'todoist.com': 'productivity', 'dropbox.com': 'productivity', 'evernote.com': 'productivity',
  'miro.com': 'productivity', 'atlassian.net': 'productivity', 'upwork.com': 'productivity',
  'fiverr.com': 'productivity', 'ads.google.com': 'productivity',

  // communication
  'linkedin.com': 'communication', 'discord.com': 'communication', 'slack.com': 'communication',
  'mail.google.com': 'communication', 'outlook.com': 'communication', 'gmail.com': 'communication',
  'whatsapp.com': 'communication', 'telegram.org': 'communication', 'zoom.us': 'communication',
  'teams.microsoft.com': 'communication', 'meet.google.com': 'communication', 'messenger.com': 'communication',

  // social media
  'instagram.com': 'social_media', 'twitter.com': 'social_media', 'x.com': 'social_media',
  'facebook.com': 'social_media', 'reddit.com': 'social_media', 'snapchat.com': 'social_media',
  'threads.net': 'social_media', 'pinterest.com': 'social_media', 'tumblr.com': 'social_media',
  'quora.com': 'social_media', 'bsky.app': 'social_media',

  // entertainment
  'netflix.com': 'entertainment', 'disneyplus.com': 'entertainment', 'twitch.tv': 'entertainment',
  'primevideo.com': 'entertainment', 'tiktok.com': 'entertainment', 'hulu.com': 'entertainment',
  'max.com': 'entertainment', 'spotify.com': 'entertainment', 'soundcloud.com': 'entertainment',
  '9gag.com': 'entertainment', 'imdb.com': 'entertainment', 'crunchyroll.com': 'entertainment',
  'vimeo.com': 'entertainment', 'dailymotion.com': 'entertainment',

  // gaming
  'steampowered.com': 'gaming', 'epicgames.com': 'gaming', 'roblox.com': 'gaming',
  'chess.com': 'gaming', 'ign.com': 'gaming',

  // shopping
  'amazon.com': 'shopping', 'ebay.com': 'shopping', 'etsy.com': 'shopping',
  'aliexpress.com': 'shopping', 'walmart.com': 'shopping', 'target.com': 'shopping',
  'bestbuy.com': 'shopping', 'shein.com': 'shopping',

  // finance
  'paypal.com': 'finance', 'stripe.com': 'finance', 'coinbase.com': 'finance',
  'binance.com': 'finance', 'robinhood.com': 'finance', 'wise.com': 'finance',
  'revolut.com': 'finance', 'kraken.com': 'finance',

  // news
  'bbc.com': 'news', 'cnn.com': 'news', 'techcrunch.com': 'news', 'theverge.com': 'news',
  'arstechnica.com': 'news', 'wired.com': 'news', 'reuters.com': 'news', 'bloomberg.com': 'news',
  'theguardian.com': 'news', 'nytimes.com': 'news', 'apnews.com': 'news', 'news.ycombinator.com': 'news',

  // health
  'webmd.com': 'health', 'myfitnesspal.com': 'health', 'healthline.com': 'health',
  'mayoclinic.org': 'health', 'calm.com': 'health', 'headspace.com': 'health',
}

export function isCategory(value: string): value is Category {
  return ALL_CATEGORIES.includes(value as Category)
}

/**
 * Categorise a hostname against the domain map, falling back from the full
 * hostname to its base domain so subdomains match too (e.g. en.wikipedia.org →
 * wikipedia.org). Returns null when unknown (caller treats as 'other', which
 * the AI classifier then refines).
 */
export function categorizeDomain(domain: string): Category | null {
  if (!domain) return null
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain]
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const base = parts.slice(i).join('.')
    if (DOMAIN_MAP[base]) return DOMAIN_MAP[base]
  }
  return null
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
