import type { Achievement } from '../../shared/types'

const ALL_ACHIEVEMENTS = [
  { id: 'deep_learner', label: 'Deep Learner', icon: '📚', desc: 'Learning score ≥ 90' },
  { id: 'seven_day_focus', label: 'Seven-day Focus', icon: '🎯', desc: 'Productivity ≥ 75 for 7 days' },
  { id: 'healthy_week', label: 'Healthy Week', icon: '💚', desc: 'Health ≥ 80 for 7 days' },
  { id: 'eye_care_champion', label: 'Eye Care', icon: '👁', desc: 'All eye reminders for 3 days' },
  { id: 'balanced_day', label: 'Balanced Day', icon: '⚖️', desc: 'All scores ≥ 70' },
  { id: 'digital_minimalist', label: 'Minimalist', icon: '🧘', desc: 'Entertainment < 30m for 5 days' },
  { id: 'learning_streak', label: 'Learning Streak', icon: '🔥', desc: 'Learning every day for 7 days' },
]

interface Props { achievements: Achievement[] }

export function Achievements({ achievements }: Props) {
  const unlockedIds = new Set(achievements.map(a => a.id))
  return (
    <div className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Achievements</h3>
      <div className="grid grid-cols-4 gap-3">
        {ALL_ACHIEVEMENTS.map(a => (
          <div
            key={a.id}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl ${unlockedIds.has(a.id) ? 'bg-blue-950/60 border border-blue-500/30' : 'opacity-30'}`}
            title={a.desc}
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-xs text-slate-400 text-center leading-tight">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
