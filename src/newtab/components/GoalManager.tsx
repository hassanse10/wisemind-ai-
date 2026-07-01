import { useState } from 'react'
import type { Goal } from '../../shared/types'
import type { Category } from '../../shared/types'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '../../shared/constants'
import { addGoal, putGoal } from '../../shared/db'

interface Props {
  goals: Goal[]
  onChange: () => void
}

const TARGET_OPTIONS: Array<{ value: Goal['target']; label: string }> = [
  ...ALL_CATEGORIES.map(cat => ({ value: cat as Goal['target'], label: CATEGORY_LABELS[cat] })),
  { value: 'shorts', label: 'Short Videos' },
]

function goalTargetLabel(target: Goal['target']): string {
  if (target === 'shorts') return 'Short Videos'
  if (target === 'sleep') return 'Sleep'
  return CATEGORY_LABELS[target as Category] ?? target
}

export function GoalManager({ goals, onChange }: Props) {
  const [type, setType] = useState<'reduce' | 'increase'>('reduce')
  const [target, setTarget] = useState<Goal['target']>(ALL_CATEGORIES[0])
  const [dailyLimitMinutes, setDailyLimitMinutes] = useState<string>('')

  async function handleAdd() {
    const limit = parseInt(dailyLimitMinutes, 10)
    if (!limit || limit <= 0) return

    const newGoal: Goal = {
      id: crypto.randomUUID(),
      type,
      target,
      dailyLimitMinutes: limit,
      weeklyTargetMinutes: null,
      createdAt: Date.now(),
      active: true,
    }
    await addGoal(newGoal)
    setDailyLimitMinutes('')
    onChange()
  }

  async function handleRemove(goal: Goal) {
    await putGoal({ ...goal, active: false })
    onChange()
  }

  return (
    <div className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-2xl p-5">
      <h3 className="font-display text-base text-[#362b1a] mb-4">Manage Goals</h3>

      {/* Create form */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-type" className="text-xs text-[#5d5138]">
              Type
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={e => setType(e.target.value as 'reduce' | 'increase')}
              className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] rounded-lg px-3 py-1.5 text-sm text-[#362b1a] focus:outline-none focus:ring-2 focus:ring-[#4d7c57]"
            >
              <option value="reduce">Reduce</option>
              <option value="increase">Increase</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target" className="text-xs text-[#5d5138]">
              Target
            </label>
            <select
              id="goal-target"
              value={target}
              onChange={e => setTarget(e.target.value as Goal['target'])}
              className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] rounded-lg px-3 py-1.5 text-sm text-[#362b1a] focus:outline-none focus:ring-2 focus:ring-[#4d7c57]"
            >
              {TARGET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="goal-daily-limit" className="text-xs text-[#5d5138]">
              Daily Limit (minutes)
            </label>
            <input
              id="goal-daily-limit"
              type="number"
              min={1}
              value={dailyLimitMinutes}
              onChange={e => setDailyLimitMinutes(e.target.value)}
              placeholder="e.g. 30"
              className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.3)] rounded-lg px-3 py-1.5 text-sm text-[#362b1a] w-32 focus:outline-none focus:ring-2 focus:ring-[#4d7c57]"
            />
          </div>
        </div>

        <button
          onClick={() => void handleAdd()}
          disabled={!dailyLimitMinutes || parseInt(dailyLimitMinutes, 10) <= 0}
          className="px-5 py-1.5 bg-[#2f5238] hover:bg-[#4d7c57] disabled:opacity-40 disabled:cursor-not-allowed rounded-[20px] text-sm font-semibold text-[#f3ecd9] border-[1.5px] border-[#2f5238] transition-colors"
        >
          Add Goal
        </button>
      </div>

      {/* Existing goals list */}
      {goals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#7a6a4f] uppercase tracking-wide">Active Goals</p>
          {goals.map(g => (
            <div
              key={g.id}
              className="flex items-center justify-between bg-[#f3ecd9] rounded-lg px-3 py-2"
            >
              <span className="text-sm text-[#463a25]">
                <span className="capitalize text-[#4d7c57] font-semibold">{g.type}</span>{' '}
                {goalTargetLabel(g.target)}
                {g.dailyLimitMinutes != null && (
                  <span className="text-[#7a6a4f] ml-1">({g.dailyLimitMinutes}m/day)</span>
                )}
              </span>
              <button
                onClick={() => void handleRemove(g)}
                className="text-xs transition-colors ml-4 border-[1.5px] border-[rgba(54,43,26,.35)] rounded-[16px] px-3 py-0.5 text-[#5d5138] hover:text-[#362b1a]"
                aria-label={`Remove ${goalTargetLabel(g.target)} goal`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
