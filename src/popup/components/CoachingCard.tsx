interface Props { message: string; onDismiss: () => void }

export function CoachingCard({ message, onDismiss }: Props) {
  return (
    <div className="bg-blue-950/60 border border-blue-500/20 rounded-xl p-3">
      <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
      <button onClick={onDismiss} className="mt-2 text-xs text-blue-400 hover:text-blue-300">Dismiss</button>
    </div>
  )
}
