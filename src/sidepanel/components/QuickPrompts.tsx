const PROMPTS = [
  'How am I doing?',
  'Am I improving?',
  'Give me a tip',
]

interface Props { onSelect: (prompt: string) => void }

export function QuickPrompts({ onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {PROMPTS.map(p => (
        <button
          key={p}
          onClick={() => onSelect(p)}
          className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/5 px-3.5 py-2 text-xs font-semibold text-ink-300 transition-colors hover:bg-white/10"
        >
          {p}
        </button>
      ))}
    </div>
  )
}
