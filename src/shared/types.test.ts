import { describe, it, expect } from 'vitest'
import { isCategory, PRODUCTIVE_CATEGORIES } from './constants'

describe('isCategory', () => {
  it('returns true for valid category', () => {
    expect(isCategory('learning')).toBe(true)
  })
  it('returns false for invalid string', () => {
    expect(isCategory('invalid')).toBe(false)
  })
})

describe('PRODUCTIVE_CATEGORIES', () => {
  it('includes programming and learning', () => {
    expect(PRODUCTIVE_CATEGORIES).toContain('programming')
    expect(PRODUCTIVE_CATEGORIES).toContain('learning')
  })
  it('does not include entertainment', () => {
    expect(PRODUCTIVE_CATEGORIES).not.toContain('entertainment')
  })
})
