interface Props { message: string; onDismiss: () => void }

/** Coaching message card with the mentor identity, styled to the WiseMind design. */
export function CoachingCard({ message, onDismiss }: Props) {
  return (
    <div
      className="rounded-2xl border border-health/20 p-3.5"
      style={{ background: 'linear-gradient(150deg, rgba(52,211,153,.10), rgba(59,130,246,.07))' }}
    >
      <div className="flex gap-3">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-[15px] wm-brand-grad">
          🧠
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-wide text-health">SAGE · WISE MENTOR</span>
            <span className="h-1.5 w-1.5 rounded-full bg-health wm-anim-pulse" />
          </div>
          <p className="text-[13px] leading-relaxed text-ink-200">{message}</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="mt-3 w-full rounded-[10px] border border-white/12 bg-white/5 py-2 text-[12.5px] font-semibold text-ink-300 transition-colors hover:bg-white/10"
      >
        Dismiss
      </button>
    </div>
  )
}
