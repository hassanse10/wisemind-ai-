import { useState, useEffect } from 'react'
import type { Scores } from '../types'
import { getSettings } from '../StorageManager'
import { onMessage } from '../messaging'

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
    onMessage(msg => {
      if (msg.type === 'SCORE_UPDATE') {
        setScores(msg.payload)
      }
    })
  }, [])

  return scores
}
