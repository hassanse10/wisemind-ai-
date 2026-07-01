import { ScoreRing } from '../../popup/components/ScoreRing'

interface Props { health: number; productivity: number; learning: number }

const CARDS = [
  {
    key: 'health' as const,
    label: 'Health',
    color: '#4d7c57',
    bg: '#eef0e0',
    border: '#4d7c57',
    desc: 'Rest & balanced screen time',
    starsColor: '#4d7c57',
    starsCount: 4,
  },
  {
    key: 'prod' as const,
    label: 'Productivity',
    color: '#58789f',
    bg: '#e8edf2',
    border: '#58789f',
    desc: 'Deep-focus blocks today',
    starsColor: '#58789f',
    starsCount: 3,
  },
  {
    key: 'learn' as const,
    label: 'Learning',
    color: '#c9892f',
    bg: '#f6ead2',
    border: '#c9892f',
    desc: 'Time invested in growth',
    starsColor: '#96650f',
    starsCount: 5,
  },
] as const

function starRating(filled: number, color: string) {
  const total = 5
  return (
    <div className="mt-2 text-[13px] tracking-[3px]" style={{ color }}>
      {'✦'.repeat(filled)}
      <span style={{ opacity: 0.3 }}>{'✦'.repeat(total - filled)}</span>
    </div>
  )
}

export function ScoreCards({ health, productivity, learning }: Props) {
  const values = { health, prod: productivity, learn: learning }
  return (
    <div className="grid grid-cols-3 gap-[18px]">
      {CARDS.map(({ key, label, color, bg, border, desc, starsColor, starsCount }) => (
        <div
          key={key}
          className="flex items-center gap-[18px] rounded-[18px] p-[22px]"
          style={{ background: bg, border: `1.5px solid ${border}` }}
        >
          <ScoreRing score={values[key]} label="" color={color} size={92} stroke={8} />
          <div>
            <div className="mb-1 font-display text-base font-semibold text-[#362b1a]">{label}</div>
            <div className="text-[13.5px] leading-relaxed text-[#7a6a4f]">{desc}</div>
            {starRating(starsCount, starsColor)}
          </div>
        </div>
      ))}
    </div>
  )
}
