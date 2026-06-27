import { useState, useRef, useEffect } from 'react'
import { ChatThread } from './components/ChatThread'
import { QuickPrompts } from './components/QuickPrompts'
import { useSettings } from '../shared/hooks/useStorage'
import type { ExtensionMessage } from '../shared/types'

const ACHIEVEMENT_LABELS: Record<string, string> = {
  deep_learner: 'Deep Learner',
  seven_day_focus: 'Seven-day Focus',
  healthy_week: 'Healthy Week',
  balanced_day: 'Balanced Day',
  digital_minimalist: 'Digital Minimalist',
  learning_streak: 'Learning Streak',
  eye_care_champion: 'Eye Care Champion',
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const PERSONALITY_INTRO: Record<string, string> = {
  wise: "I'm your Wise Mentor — calm, thoughtful, here to guide you.",
  friendly: "Hey! I'm your Friendly Coach — let's have a great day!",
  coach: "I'm your Tough Coach. No excuses. Let's get it done.",
  mindful: "I'm your Mindfulness Guide. Breathe. Let's reflect together.",
  funny: "I'm your Funny Companion 😄 — wellness with a side of laughs!",
}

const SYSTEM_PROMPTS: Record<string, string> = {
  wise: 'You are a calm, wise digital wellness mentor. Be thoughtful and insightful. Keep responses concise and supportive.',
  friendly: 'You are a friendly, upbeat digital wellness coach. Be warm and encouraging. Keep responses short and energetic.',
  coach: 'You are a strict, results-driven wellness coach. Be direct and no-nonsense. Push the user to improve. Keep responses brief.',
  mindful: 'You are a mindful wellness guide. Focus on reflection, breathing, and present-moment awareness. Speak gently and calmly.',
  funny: 'You are a funny, lighthearted wellness companion. Use humor to make wellness fun. Keep responses short with a playful tone.',
}

export interface Message { role: 'user' | 'assistant'; content: string }

export function App() {
  const settings = useSettings()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [toastLabels, setToastLabels] = useState<string[]>([])
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const listener = (msg: unknown) => {
      const m = msg as ExtensionMessage
      if (m.type === 'ACHIEVEMENT_UNLOCKED') {
        const labels = m.payload.ids
          .map(id => ACHIEVEMENT_LABELS[id] ?? id)
        setToastLabels(labels)
        if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => {
          setToastLabels([])
          toastTimerRef.current = null
        }, 5000)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (settings) {
      const intro = PERSONALITY_INTRO[settings.mentorPersonality] ?? PERSONALITY_INTRO.wise
      setMessages([{ role: 'assistant', content: intro }])
    }
  }, [settings?.mentorPersonality])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || !settings?.openrouterApiKey) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    const personality = settings.mentorPersonality ?? 'wise'
    const systemPrompt = `${SYSTEM_PROMPTS[personality] ?? SYSTEM_PROMPTS.wise} Health score today: ${settings.lastHealthScore ?? 0}/100.`

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://wisemind-ai',
          'X-Title': 'WiseMind AI',
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...next.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not respond right now.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check your API key in settings.' }])
    } finally {
      setLoading(false)
    }
  }

  if (settings?.privateModeActive) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 items-center justify-center gap-4 px-6 text-center">
        <div className="text-4xl">🔒</div>
        <p className="text-sm font-semibold text-slate-300">Private Mode Active</p>
        <p className="text-xs text-slate-500">AI coaching is disabled while private mode is on. Turn it off in Settings to continue.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Achievement toast */}
      {toastLabels.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-0 left-0 right-0 z-50 mx-3 mt-2 bg-yellow-900/90 border border-yellow-600 rounded-xl px-4 py-3 flex items-start justify-between gap-3 shadow-lg"
        >
          <div className="flex flex-col gap-1 min-w-0">
            {toastLabels.map(label => (
              <span key={label} className="text-sm font-semibold text-yellow-200">
                🏆 Achievement unlocked: {label}
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
              toastTimerRef.current = null
              setToastLabels([])
            }}
            aria-label="Dismiss achievement notification"
            className="shrink-0 text-yellow-400 hover:text-yellow-200 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-sm">
          🧠
        </div>
        <div>
          <p className="text-sm font-semibold">WiseMind Coach</p>
          <p className="text-xs text-slate-500">Health: {settings?.lastHealthScore ?? '—'}/100</p>
        </div>
      </div>

      {/* Chat thread */}
      <ChatThread messages={messages} />
      <div ref={bottomRef} />

      {/* Loading / typing indicator */}
      {loading && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-slate-500">Coach is thinking…</span>
        </div>
      )}

      {/* No API key warning */}
      {!settings?.openrouterApiKey && (
        <div className="mx-3 mb-2 text-xs text-amber-400 bg-amber-950/40 rounded-lg px-3 py-2">
          Add your OpenRouter API key in Settings to enable AI coaching.
        </div>
      )}

      {/* Quick prompt chips */}
      <QuickPrompts onSelect={sendMessage} />

      {/* Input row */}
      <div className="flex gap-2 px-3 pb-4 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="Ask your coach anything..."
          disabled={loading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium"
        >
          {loading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
