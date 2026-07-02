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
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-[#e9dfc9] font-sans text-ink-100">
      <div className="text-center">
        <div className="mb-2 font-display text-3xl font-medium tracking-tight">
          {state.done ? 'Nicely done' : state.phaseLabel}
        </div>
        <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {state.done ? 'carry the calm with you' : `Cycle ${state.cycle} of ${TOTAL_CYCLES}`}
        </div>
      </div>

      <div
        className="rounded-full"
        style={{
          width: 220,
          height: 220,
          background: 'linear-gradient(#4d7c57,#2f5238)',
          transform: `scale(${state.scale})`,
          transition: 'transform 0.2s linear',
          boxShadow: '0 0 90px -10px rgba(47,82,56,.4)',
        }}
        aria-hidden="true"
      />

      <button
        onClick={closeTab}
        className="rounded-[20px] border-[1.5px] border-[rgba(54,43,26,.35)] bg-transparent px-7 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-[rgba(54,43,26,.05)]"
      >
        Done
      </button>
    </div>
  )
}
