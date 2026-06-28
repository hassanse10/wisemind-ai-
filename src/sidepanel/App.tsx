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
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-navy-900 px-6 text-center font-sans text-ink-100">
        <div className="text-4xl">🔒</div>
        <p className="text-sm font-semibold text-ink-300">Private Mode Active</p>
        <p className="text-xs text-ink-600">AI coaching is disabled while private mode is on. Turn it off in Settings to continue.</p>
      </div>
    )
  }

  const health = settings?.lastHealthScore ?? 0

  return (
    <div className="relative flex h-screen flex-col bg-navy-900 font-sans text-ink-100">
      {/* Achievement toast */}
      {toastLabels.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-0 right-0 top-0 z-50 mx-3 mt-2 flex items-start justify-between gap-3 rounded-2xl border border-learn/30 bg-learn/[0.12] px-4 py-3 shadow-lg backdrop-blur"
        >
          <div className="flex min-w-0 flex-col gap-1">
            {toastLabels.map(label => (
              <span key={label} className="text-sm font-semibold text-learn">
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
            className="shrink-0 text-lg leading-none text-learn hover:opacity-80"
          >
            ×
          </button>
        </div>
      )}

      {/* Context bar */}
      <div
        className="shrink-0 border-b border-white/[0.06] px-5 pb-4 pt-[18px]"
        style={{ background: 'linear-gradient(180deg,rgba(59,130,246,.06),transparent)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[13px] text-xl wm-brand-grad shadow-[0_8px_18px_-6px_rgba(52,211,153,.5)]">
            🧠
          </div>
          <div className="flex-1">
            <div className="font-display text-[15px] font-semibold">Sage</div>
            <div className="text-[11.5px] font-medium text-ink-600">Your wellness coach · here to guide</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-ink-700">Today</div>
            <div className="text-xs font-semibold text-health">Health {health}/100</div>
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
            <span className="h-1.5 w-1.5 rounded-full bg-ink-600 wm-anim-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-600 wm-anim-pulse" style={{ animationDelay: '.2s' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-600 wm-anim-pulse" style={{ animationDelay: '.4s' }} />
          </div>
          <span className="text-xs text-ink-600">Coach is thinking…</span>
        </div>
      )}

      {/* No API key warning */}
      {!settings?.openrouterApiKey && (
        <div className="mx-4 mb-2 rounded-xl border border-learn/20 bg-learn/[0.08] px-3 py-2 text-xs text-learn">
          Add your OpenRouter API key in Settings to enable AI coaching.
        </div>
      )}

      {/* Quick prompt chips */}
      <QuickPrompts onSelect={sendMessage} />

      {/* Input row */}
      <div className="px-4 pb-3 pt-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 focus-within:border-prod/50">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask your coach anything..."
            disabled={loading}
            className="flex-1 bg-transparent text-[13px] text-ink-100 placeholder-ink-700 outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#06231a] wm-brand-grad disabled:opacity-40"
          >
            {loading ? '…' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
