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
