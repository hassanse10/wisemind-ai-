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

const UNLOCKED_TINTS = [
  { bg: '#eef0e0', border: '#4d7c57' }, // green
  { bg: '#f6ead2', border: '#c9892f' }, // amber
  { bg: '#e8edf2', border: '#58789f' }, // blue
]

export function Achievements({ achievements }: Props) {
  const unlockedIds = new Set(achievements.map(a => a.id))
  let unlockedIndex = 0
  return (
    <div className="bg-[#fffdf5] border-[1.5px] border-[rgba(54,43,26,.25)] rounded-2xl p-5">
      <h3 className="font-display text-base text-[#362b1a] mb-4">Achievements</h3>
      <div className="grid grid-cols-4 gap-3">
        {ALL_ACHIEVEMENTS.map(a => {
          const unlocked = unlockedIds.has(a.id)
          const tint = unlocked ? UNLOCKED_TINTS[unlockedIndex++ % UNLOCKED_TINTS.length] : null
          return (
            <div
              key={a.id}
              className="flex flex-col items-center gap-1.5"
              title={a.desc}
            >
              <div
                className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-2xl"
                style={
                  unlocked
                    ? { background: tint!.bg, border: `1.5px solid ${tint!.border}` }
                    : {
                        background: '#f3ecd9',
                        border: '1.5px dashed rgba(54,43,26,.4)',
                        filter: 'grayscale(1)',
                        opacity: 0.38,
                      }
                }
              >
                {a.icon}
              </div>
              <span
                className="text-[11px] text-center leading-tight font-bold"
                style={{ color: unlocked ? '#463a25' : '#7a6a4f' }}
              >
                {a.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
