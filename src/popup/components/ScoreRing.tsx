interface Props {
  score: number
  label: string
  color: string
  size?: number
  stroke?: number
}

/** Rounded-cap progress ring with the score centered, matching the WiseMind design. */
export function ScoreRing({ score, label, color, size = 128, stroke = 11 }: Props) {
  const r = size / 2 - stroke
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ
  const c = size / 2

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="#f3ecd9" stroke="rgba(54,43,26,.18)" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-normal leading-none tracking-tight text-ink-100"
          style={{ fontSize: size * 0.3 }}
        >
          {score}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-500">
          {label}
        </span>
      </div>
    </div>
  )
}
