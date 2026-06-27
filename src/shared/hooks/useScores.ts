import { useState, useEffect } from 'react'
import type { Scores, ExtensionMessage } from '../types'
import { getSettings } from '../StorageManager'

export function useScores(): Scores | null {
  const [scores, setScores] = useState<Scores | null>(null)

  useEffect(() => {
    // Derive initial scores from stored settings
    getSettings().then(settings => {
      const summary = settings.todaysSummary
      setScores({
        health: summary?.healthScore ?? settings.lastHealthScore,
        productivity: summary?.productivityScore ?? 0,
        learning: summary?.learningScore ?? 0,
      })
    })

    // Listen for real-time score updates from the background
    const listener = (msg: unknown) => {
      const m = msg as ExtensionMessage
      if (m.type === 'SCORE_UPDATE') {
        setScores(m.payload)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  return scores
}
