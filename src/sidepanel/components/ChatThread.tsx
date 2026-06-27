interface Message { role: 'user' | 'assistant'; content: string }

interface Props { messages: Message[] }

export function ChatThread({ messages }: Props) {
  return (
    <div className="flex flex-col gap-3 py-4 px-3 overflow-y-auto flex-1">
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            m.role === 'user'
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-200 rounded-bl-sm'
          }`}>
            {m.content}
          </div>
        </div>
      ))}
    </div>
  )
}
