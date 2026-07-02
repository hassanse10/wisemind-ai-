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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#faf5e9] px-6 text-center font-sans text-ink-100">
        <div className="text-4xl">🔒</div>
        <p className="text-sm font-semibold text-ink-300">Private Mode Active</p>
        <p className="text-xs text-ink-500">AI coaching is disabled while private mode is on. Turn it off in Settings to continue.</p>
      </div>
    )
  }

  const health = settings?.lastHealthScore ?? 0

  return (
    <div className="relative flex h-screen flex-col bg-[#faf5e9] font-sans text-ink-100">
      {/* Achievement toast */}
      {toastLabels.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-0 right-0 top-0 z-50 mx-3 mt-2 flex items-start justify-between gap-3 rounded-2xl border border-[#c9892f]/30 bg-[#c9892f]/[0.12] px-4 py-3 shadow-lg"
        >
          <div className="flex min-w-0 flex-col gap-1">
            {toastLabels.map(label => (
              <span key={label} className="text-sm font-semibold text-[#c9892f]">
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
            className="shrink-0 text-lg leading-none text-[#c9892f] hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}

      {/* Context bar */}
      <div className="shrink-0 border-b border-[rgba(54,43,26,.22)] bg-[#f3ecd9] px-5 pb-[15px] pt-[18px]">
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#2f5238] border-2 border-[#362b1a]">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V9"/><path d="M12 9C12 5 9 3.5 5.5 4 5 8 7.5 10.5 12 9z"/><path d="M12 13c0-4 3-5.5 6.5-5-.5 4-3 6.5-6.5 5z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-display text-[16px]">Sage</div>
            <div className="text-[12.5px] font-medium text-ink-500">Your wellness coach · here to guide</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-[#a3947a]">Today</div>
            <div className="text-xs font-semibold text-[#2f5238]">Health {health}/100</div>
          </div>
        </div>
      </div>

      {/* Chat thread */}
      <ChatThread messages={messages} />
      <div ref={bottomRef} />

      {/* Loading / typing indicator */}
      {loading && (
        <div className="flex items-center gap-2 px-5 pb-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a3947a] wm-anim-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#a3947a] wm-anim-pulse" style={{ animationDelay: '.2s' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#a3947a] wm-anim-pulse" style={{ animationDelay: '.4s' }} />
          </div>
          <span className="text-xs text-ink-500">Coach is thinking…</span>
        </div>
      )}

      {/* No API key warning */}
      {!settings?.openrouterApiKey && (
        <div className="mx-4 mb-2 rounded-xl border border-[#c9892f]/20 bg-[#c9892f]/[0.08] px-3 py-2 text-xs text-[#96650f]">
          Add your OpenRouter API key in Settings to enable AI coaching.
        </div>
      )}

      {/* Quick prompt chips */}
      <QuickPrompts onSelect={sendMessage} />

      {/* Input row */}
      <div className="px-4 pb-3 pt-2.5">
        <div className="flex items-center gap-2.5 rounded-[22px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-[#fffdf5] px-3.5 py-2.5">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask your coach anything..."
            disabled={loading}
            className="flex-1 bg-transparent text-[13px] text-ink-100 placeholder:text-ink-500 placeholder:italic outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f5238] disabled:opacity-40"
          >
            {loading ? (
              <span className="text-[#f3ecd9] text-sm">…</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f3ecd9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
