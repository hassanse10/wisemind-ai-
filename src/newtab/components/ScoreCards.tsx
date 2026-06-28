import { ScoreRing } from '../../popup/components/ScoreRing'

interface Props { health: number; productivity: number; learning: number }

const CARDS = [
  { key: 'health', label: 'Health', color: '#34d399', tint: 'rgba(52,211,153', desc: 'Rest & balanced screen time' },
  { key: 'prod', label: 'Productivity', color: '#5b9bff', tint: 'rgba(91,155,255', desc: 'Deep-focus blocks today' },
  { key: 'learn', label: 'Learning', color: '#f7b955', tint: 'rgba(247,185,85', desc: 'Time invested in growth' },
] as const

export function ScoreCards({ health, productivity, learning }: Props) {
  const values = { health, prod: productivity, learn: learning }
  return (
    <div className="grid grid-cols-3 gap-[18px]">
      {CARDS.map(({ key, label, color, tint, desc }) => (
        <div
          key={key}
          className="flex items-center gap-[18px] rounded-[20px] p-[22px]"
          style={{ background: `${tint},.05)`, border: `1px solid ${tint},.16)` }}
        >
          <ScoreRing score={values[key]} label="" color={color} size={92} stroke={8} />
          <div>
            <div className="mb-1 font-display text-base font-semibold">{label}</div>
            <div className="text-[12.5px] leading-relaxed text-ink-500">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
