import { useState, useEffect, useRef } from 'react'
import { breathingState, TOTAL_CYCLES } from './breathing'

function closeTab(): void {
  chrome.tabs.getCurrent(tab => {
    if (tab?.id !== undefined) chrome.tabs.remove(tab.id)
  })
}

export function App() {
  const startRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000)
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeTab()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const state = breathingState(elapsed)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-navy-950 font-sans text-ink-100">
      <div className="text-center">
        <div className="mb-2 font-display text-3xl font-medium tracking-tight">
          {state.done ? 'Nicely done' : state.phaseLabel}
        </div>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-600">
          {state.done ? 'carry the calm with you' : `Cycle ${state.cycle} of ${TOTAL_CYCLES}`}
        </div>
      </div>

      <div
        className="rounded-full wm-brand-grad"
        style={{
          width: 220,
          height: 220,
          transform: `scale(${state.scale})`,
          transition: 'transform 0.2s linear',
          boxShadow: '0 0 90px -10px rgba(52,211,153,0.55)',
        }}
        aria-hidden="true"
      />

      <button
        onClick={closeTab}
        className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-7 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10"
      >
        Done
      </button>
    </div>
  )
}
