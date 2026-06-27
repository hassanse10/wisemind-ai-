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
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Manage Goals</h3>

      {/* Create form */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-type" className="text-xs text-slate-400">
              Type
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={e => setType(e.target.value as 'reduce' | 'increase')}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="reduce">Reduce</option>
              <option value="increase">Increase</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target" className="text-xs text-slate-400">
              Target
            </label>
            <select
              id="goal-target"
              value={target}
              onChange={e => setTarget(e.target.value as Goal['target'])}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TARGET_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="goal-daily-limit" className="text-xs text-slate-400">
              Daily Limit (minutes)
            </label>
            <input
              id="goal-daily-limit"
              type="number"
              min={1}
              value={dailyLimitMinutes}
              onChange={e => setDailyLimitMinutes(e.target.value)}
              placeholder="e.g. 30"
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={() => void handleAdd()}
          disabled={!dailyLimitMinutes || parseInt(dailyLimitMinutes, 10) <= 0}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          Add Goal
        </button>
      </div>

      {/* Existing goals list */}
      {goals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Active Goals</p>
          {goals.map(g => (
            <div
              key={g.id}
              className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-slate-200">
                <span className="capitalize text-blue-400">{g.type}</span>{' '}
                {goalTargetLabel(g.target)}
                {g.dailyLimitMinutes != null && (
                  <span className="text-slate-400 ml-1">({g.dailyLimitMinutes}m/day)</span>
                )}
              </span>
              <button
                onClick={() => void handleRemove(g)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors ml-4"
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
