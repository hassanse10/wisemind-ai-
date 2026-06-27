import { ScoreRing } from '../../popup/components/ScoreRing'

interface Props { health: number; productivity: number; learning: number }

export function ScoreCards({ health, productivity, learning }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { score: health, label: 'Health', color: '#10b981' },
        { score: productivity, label: 'Productivity', color: '#3b82f6' },
        { score: learning, label: 'Learning', color: '#8b5cf6' },
      ].map(({ score, label, color }) => (
        <div key={label} className="bg-slate-800/60 rounded-2xl p-6 flex flex-col items-center border border-slate-700/50">
          <ScoreRing score={score} label={label} color={color} size={100} />
        </div>
      ))}
    </div>
  )
}
