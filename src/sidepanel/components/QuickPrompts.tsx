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
          className="whitespace-nowrap rounded-full border-[1.5px] border-[rgba(54,43,26,.3)] bg-transparent px-3.5 py-2 text-xs font-semibold text-ink-300 transition-colors hover:bg-[rgba(54,43,26,.05)]"
        >
          {p}
        </button>
      ))}
    </div>
  )
}
