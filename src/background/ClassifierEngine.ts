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
