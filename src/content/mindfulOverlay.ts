
const OVERLAY_STYLES = `
  :host { all: initial; }
  .overlay {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; font-family: system-ui, sans-serif;
    background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
    padding: 20px 24px; width: 360px; color: #f1f5f9;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: slideUp 0.3s ease;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } }
  .title { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
  .message { font-size: 15px; line-height: 1.5; margin-bottom: 12px; }
  .stats { font-size: 13px; color: #64748b; margin-bottom: 16px; }
  .moods { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .mood-btn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 6px 12px; font-size: 13px; color: #cbd5e1; cursor: pointer; }
  .mood-btn:hover { background: rgba(255,255,255,0.15); }
  .actions { display: flex; gap: 8px; }
  .btn { flex: 1; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: rgba(255,255,255,0.1); color: #cbd5e1; }
  .btn:hover { opacity: 0.85; }
  .close { position: absolute; top: 12px; right: 14px; background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; }
  .break-instruction { font-size: 14px; line-height: 1.5; color: #cbd5e1; margin-bottom: 16px; }
  .countdown { font-size: 40px; font-weight: 700; text-align: center; color: #34d399; margin: 8px 0 16px; font-variant-numeric: tabular-nums; }
  .break-done { font-size: 14px; text-align: center; color: #34d399; margin-bottom: 16px; }
`

function createOverlay(message: string, stats: string): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Mindful Check-in</div>
    <div class="message"></div>
    ${stats ? `<div class="stats"></div>` : ''}
    <div class="moods">
      <button class="mood-btn" data-mood="energized">😊 Energized</button>
      <button class="mood-btn" data-mood="fine">😐 Fine</button>
      <button class="mood-btn" data-mood="tired">😴 Tired</button>
      <button class="mood-btn" data-mood="just_scrolling">😵 Just scrolling</button>
    </div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="continue">Continue</button>
      <button class="btn btn-primary" data-action="take_break">Take a Break</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  // Set message and stats via textContent to prevent XSS
  const msgEl = card.querySelector('.message')
  if (msgEl) msgEl.textContent = message
  const statsEl = card.querySelector('.stats')
  if (statsEl) statsEl.textContent = stats

  const dismiss = (response: 'continue' | 'take_break' | 'dismissed', mood: string | null = null) => {
    // Guard against a stale context after an extension reload.
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'COACHING_RESPONSE', payload: { response, mood } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  card.querySelector('.close')?.addEventListener('click', () => dismiss('dismissed'))
  card.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      card.querySelectorAll('.mood-btn').forEach(b => (b as HTMLElement).style.background = 'rgba(255,255,255,0.07)')
      ;(e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.4)'
    })
  })
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action as 'continue' | 'take_break'
      const activeMood = card.querySelector('.mood-btn[style*="0.4"]') as HTMLElement | null
      dismiss(action, activeMood?.dataset.mood ?? null)
    })
  })

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_MINDFUL_CHECKIN') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createOverlay(msg.payload.message, msg.payload.stats)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})

function createBreakOverlay(title: string, instruction: string, durationSec: number): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Time to move</div>
    <div class="message"></div>
    <div class="break-instruction"></div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="skip">Skip</button>
      <button class="btn btn-secondary" data-action="snooze">Snooze 5m</button>
      <button class="btn btn-primary" data-action="start">Start</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const msgEl = card.querySelector('.message')
  if (msgEl) msgEl.textContent = title
  const instrEl = card.querySelector('.break-instruction')
  if (instrEl) instrEl.textContent = instruction

  let timer: ReturnType<typeof setInterval> | null = null

  const report = (response: 'completed' | 'skipped' | 'snoozed') => {
    if (timer) clearInterval(timer)
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'BREAK_RESPONSE', payload: { response } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  const startCountdown = () => {
    const actions = card.querySelector('.actions')
    if (actions) actions.remove()
    if (instrEl) instrEl.remove()
    const count = document.createElement('div')
    count.className = 'countdown'
    let remaining = durationSec
    count.textContent = String(remaining)
    card.appendChild(count)
    timer = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        count.textContent = String(remaining)
        return
      }
      if (timer) clearInterval(timer)
      count.remove()
      const done = document.createElement('div')
      done.className = 'break-done'
      done.textContent = '✓ Nicely done — your eyes and body thank you.'
      card.appendChild(done)
      const ok = document.createElement('button')
      ok.className = 'btn btn-primary'
      ok.textContent = 'Done'
      ok.addEventListener('click', () => report('completed'))
      card.appendChild(ok)
    }, 1000)
  }

  card.querySelector('.close')?.addEventListener('click', () => report('skipped'))
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action
      if (action === 'start') startCountdown()
      else if (action === 'snooze') report('snoozed')
      else report('skipped')
    })
  })

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_BREAK_PROMPT') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createBreakOverlay(msg.payload.title, msg.payload.instruction, msg.payload.durationSec)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})

function createWindDownOverlay(message: string): HTMLElement {
  const host = document.createElement('div')
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES

  const card = document.createElement('div')
  card.className = 'overlay'
  card.innerHTML = `
    <button class="close" aria-label="Close">✕</button>
    <div class="title">Bedtime wind-down</div>
    <div class="message"></div>
    <div class="actions">
      <button class="btn btn-secondary" data-action="snooze">Snooze 15m</button>
      <button class="btn btn-primary" data-action="dismiss">Dismiss</button>
    </div>
  `

  shadow.appendChild(style)
  shadow.appendChild(card)

  const msgEl = card.querySelector('.message')
  if (msgEl) msgEl.textContent = message

  const report = (response: 'dismissed' | 'snoozed') => {
    try {
      if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'WIND_DOWN_RESPONSE', payload: { response } })
    } catch {
      // ignore — context invalidated
    }
    host.remove()
  }

  card.querySelector('.close')?.addEventListener('click', () => report('dismissed'))
  card.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = (e.currentTarget as HTMLElement).dataset.action
      report(action === 'snooze' ? 'snoozed' : 'dismissed')
    })
  })

  return host
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_WIND_DOWN') {
    const existing = document.getElementById('wisemind-overlay-host')
    existing?.remove()
    const host = createWindDownOverlay(msg.payload.message)
    host.id = 'wisemind-overlay-host'
    document.body.appendChild(host)
  }
})

const NUDGE_STYLES = `
  :host { all: initial; }
  .nudge {
    position: fixed; bottom: 24px; right: 24px;
    z-index: 2147483646; font-family: system-ui, sans-serif;
    background: rgba(15,23,42,0.95); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 12px 16px; color: #e2e8f0; font-size: 13.5px; line-height: 1.4; max-width: 280px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4); pointer-events: none;
    opacity: 0; transform: translateY(8px); transition: opacity .4s ease, transform .4s ease;
  }
  .nudge.show { opacity: 1; transform: translateY(0); }
`

function showNudgeToast(message: string): void {
  const existing = document.getElementById('wisemind-nudge-toast')
  existing?.remove()

  const host = document.createElement('div')
  host.id = 'wisemind-nudge-toast'
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = NUDGE_STYLES

  const toast = document.createElement('div')
  toast.className = 'nudge'
  toast.textContent = message

  shadow.appendChild(style)
  shadow.appendChild(toast)
  document.body.appendChild(host)

  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => host.remove(), 400)
  }, 6000)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_NUDGE') {
    showNudgeToast(msg.payload.message)
  }
})
