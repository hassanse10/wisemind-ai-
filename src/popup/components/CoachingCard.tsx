interface Props { message: string; onDismiss: () => void }

/** Coaching message card with the mentor identity, styled to the WiseMind design. */
export function CoachingCard({ message, onDismiss }: Props) {
  return (
    <div className="rounded-[15px] border-[1.5px] border-[#4d7c57] bg-[#eef0e0] p-[14px]">
      <div className="flex gap-[11px]">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#362b1a] bg-[#2f5238]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21V9"/>
            <path d="M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z"/>
            <path d="M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-[#2f5238]">SAGE · WISE MENTOR</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#4d7c57] wm-anim-pulse" />
          </div>
          <p className="text-[14px] leading-relaxed text-ink-200">{message}</p>
        </div>
      </div>
      <div className="mt-[13px] flex gap-2">
        <button
          onClick={onDismiss}
          className="flex-1 rounded-[20px] border-[1.5px] border-[#2f5238] bg-[#2f5238] py-[9px] text-[13px] font-extrabold text-[#f3ecd9] transition-colors hover:bg-[#3d6849]"
        >
          Take a break
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 rounded-[20px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-transparent py-[9px] text-[13px] font-bold text-ink-300 transition-colors hover:bg-[rgba(54,43,26,.06)]"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
