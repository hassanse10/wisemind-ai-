const PROMPTS = [
  'How am I doing today?',
  'Am I improving?',
  'Give me a tip',
]

interface Props { onSelect: (prompt: string) => void }

export function QuickPrompts({ onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap px-3 pb-2">
      {PROMPTS.map(p => (
        <button key={p} onClick={() => onSelect(p)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-3 py-1.5 border border-slate-700">
          {p}
        </button>
      ))}
    </div>
  )
}
