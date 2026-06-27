interface Props { score: number; label: string; color: string; size?: number }

export function ScoreRing({ score, label, color, size = 80 }: Props) {
  const r = (size / 2) - 6
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="text-2xl font-bold text-slate-100 -mt-[56px] rotate-90 relative z-10">{score}</span>
      <span className="text-xs text-slate-400 mt-8">{label}</span>
    </div>
  )
}
