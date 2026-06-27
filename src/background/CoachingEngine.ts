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

  resetSession(): void {
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
