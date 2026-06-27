import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GoalManager } from './GoalManager'
import type { Goal } from '../../shared/types'

vi.mock('../../shared/db', () => ({
  addGoal: vi.fn().mockResolvedValue(undefined),
  putGoal: vi.fn().mockResolvedValue(undefined),
}))

const mockGoal: Goal = {
  id: 'goal-1',
  type: 'reduce',
  target: 'entertainment',
  dailyLimitMinutes: 30,
  weeklyTargetMinutes: null,
  createdAt: 1000000,
  active: true,
}

beforeEach(() => vi.clearAllMocks())

describe('GoalManager', () => {
  it('renders the create form and existing goals in the list', () => {
    const onChange = vi.fn()
    render(<GoalManager goals={[mockGoal]} onChange={onChange} />)

    // Form elements
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/daily limit/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add goal/i })).toBeInTheDocument()

    // Existing goal — multiple elements may contain 'Entertainment' (option + goal list)
    expect(screen.getAllByText(/entertainment/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('filling the form and clicking Add Goal calls addGoal with correct shape and calls onChange', async () => {
    const { addGoal } = await import('../../shared/db')
    const onChange = vi.fn()
    render(<GoalManager goals={[]} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'reduce' } })
    fireEvent.change(screen.getByLabelText(/target/i), { target: { value: 'gaming' } })
    fireEvent.change(screen.getByLabelText(/daily limit/i), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))

    await waitFor(() => {
      expect(addGoal).toHaveBeenCalledTimes(1)
    })

    const calledWith = vi.mocked(addGoal).mock.calls[0][0]
    expect(calledWith.type).toBe('reduce')
    expect(calledWith.target).toBe('gaming')
    expect(calledWith.dailyLimitMinutes).toBe(45)
    expect(calledWith.active).toBe(true)
    expect(calledWith.weeklyTargetMinutes).toBeNull()
    expect(typeof calledWith.id).toBe('string')
    expect(typeof calledWith.createdAt).toBe('number')

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  it('clicking Remove calls putGoal with active:false and calls onChange', async () => {
    const { putGoal } = await import('../../shared/db')
    const onChange = vi.fn()
    render(<GoalManager goals={[mockGoal]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => {
      expect(putGoal).toHaveBeenCalledTimes(1)
    })

    const calledWith = vi.mocked(putGoal).mock.calls[0][0]
    expect(calledWith.id).toBe('goal-1')
    expect(calledWith.active).toBe(false)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  it('Add Goal with empty dailyLimitMinutes does NOT call addGoal', async () => {
    const { addGoal } = await import('../../shared/db')
    const onChange = vi.fn()
    render(<GoalManager goals={[]} onChange={onChange} />)

    // Do not fill in dailyLimitMinutes — leave it empty/0
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))

    // Wait a tick for any async side effects
    await new Promise(r => setTimeout(r, 10))
    expect(addGoal).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Add Goal with 0 dailyLimitMinutes does NOT call addGoal', async () => {
    const { addGoal } = await import('../../shared/db')
    const onChange = vi.fn()
    render(<GoalManager goals={[]} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/daily limit/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))

    await new Promise(r => setTimeout(r, 10))
    expect(addGoal).not.toHaveBeenCalled()
  })
})
