import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthTrends } from './HealthTrends'
import type { DailySummary } from '../../shared/types'

function makeSummary(date: string, healthScore: number): DailySummary {
  return {
    date, totalTime: 3600, byCategory: {} as DailySummary['byCategory'],
    shortVideoCount: 0, shortVideoDuration: 0, healthScore,
    productivityScore: 0, learningScore: 0, breaks: 3, lateNightMinutes: 12, topSites: [],
  }
}

describe('HealthTrends', () => {
  it('renders the four metric rows for 2+ days of data', () => {
    render(<HealthTrends summaries={[makeSummary('2026-06-10', 70), makeSummary('2026-06-11', 80)]} />)
    expect(screen.getByText('Health Trends')).toBeInTheDocument()
    expect(screen.getByText('Late-night')).toBeInTheDocument()
    expect(screen.getByText('Breaks/day')).toBeInTheDocument()
    expect(screen.getByText('Screen time')).toBeInTheDocument()
    expect(screen.getByText('Health score')).toBeInTheDocument()
  })

  it('renders nothing for fewer than 2 days', () => {
    const { container } = render(<HealthTrends summaries={[makeSummary('2026-06-10', 70)]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
