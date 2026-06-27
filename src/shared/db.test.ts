// src/shared/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { addVisit, getVisitsByDateRange, getUnclassifiedVisits, updateVisit } from './db'
import type { Visit } from './types'

let counter = 0
const uid = () => `v-${++counter}-${Math.random().toString(36).slice(2)}`

const makeVisit = (overrides: Partial<Visit> = {}): Visit => ({
  id: uid(),
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
    const v = makeVisit({ startTime: 1_000_000 })
    await addVisit(v)
    const results = await getVisitsByDateRange(0, 2_000_000)
    expect(results.some(r => r.id === v.id)).toBe(true)
  })

  it('getUnclassifiedVisits returns only unclassified', async () => {
    const v2 = makeVisit({ classified: false })
    const v3 = makeVisit({ classified: true })
    await addVisit(v2)
    await addVisit(v3)
    const unclassified = await getUnclassifiedVisits()
    expect(unclassified.some(v => v.id === v2.id)).toBe(true)
    expect(unclassified.some(v => v.id === v3.id)).toBe(false)
  })

  it('updateVisit mutates the record', async () => {
    const v = makeVisit({ classified: false })
    await addVisit(v)
    await updateVisit({ ...v, classified: true })
    const all = await getVisitsByDateRange(0, 2_000_000)
    const updated = all.find(r => r.id === v.id)
    expect(updated?.classified).toBe(true)
  })
})
