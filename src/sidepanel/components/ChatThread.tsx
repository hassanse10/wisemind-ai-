interface Message { role: 'user' | 'assistant'; content: string }

interface Props { messages: Message[] }

const AVATAR = (
  <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[13px] wm-brand-grad">🧠</div>
)

export function ChatThread({ messages }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex justify-end">
            <div
              className="max-w-[80%] rounded-[16px_4px_16px_16px] px-3.5 py-2.5 text-[13px] leading-[1.55] text-white"
              style={{ background: 'linear-gradient(140deg,#3b82f6,#2563eb)' }}
            >
              {m.content}
            </div>
          </div>
        ) : (
          <div key={i} className="flex max-w-[90%] gap-2.5">
            {AVATAR}
            <div className="rounded-[4px_16px_16px_16px] border border-white/[0.06] bg-white/5 px-3.5 py-2.5 text-[13px] leading-[1.55] text-ink-200">
              {m.content}
            </div>
          </div>
        )
      )}
    </div>
  )
}
