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
