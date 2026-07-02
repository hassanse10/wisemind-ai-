interface Message { role: 'user' | 'assistant'; content: string }

interface Props { messages: Message[] }

const AVATAR = (
  <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#2f5238] border-[1.5px] border-[#362b1a]">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V9"/><path d="M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z"/><path d="M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z"/>
    </svg>
  </div>
)

export function ChatThread({ messages }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[80%] rounded-[16px_4px_16px_16px] bg-[#2f5238] px-3.5 py-2.5 text-[13px] leading-[1.55] text-[#f3ecd9]">
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="flex max-w-[90%] gap-2.5">
            {AVATAR}
            <div className="rounded-[4px_16px_16px_16px] border-[1.5px] border-[rgba(54,43,26,.25)] bg-[#fffdf5] px-3.5 py-2.5 text-[13px] leading-[1.55] text-ink-200">
              {m.content}
            </div>
          </div>
        )
      )}
    </div>
  )
}
