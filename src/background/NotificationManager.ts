export const NotificationManager = {
  async deliver(message: string, stats: string = ''): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_MINDFUL_CHECKIN', payload: { message, stats } })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'WiseMind AI', message })
  },
  async deliverBreak(prompt: { title: string; instruction: string; durationSec: number }): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_BREAK_PROMPT', payload: prompt })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: prompt.title, message: prompt.instruction })
  },
  async deliverWindDown(message: string): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_WIND_DOWN', payload: { message } })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Bedtime wind-down', message })
  },
  async deliverNudge(message: string): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId === undefined) return
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'SHOW_NUDGE', payload: { message } })
    } catch {
      // restricted page — skip silently; a missed posture nudge doesn't matter
    }
  },
  async deliverEyeStrainCare(steps: { id: string; title: string; instruction: string; durationSec: number }[]): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'SHOW_EYE_STRAIN_CARE', payload: { steps } })
        return
      } catch {
        // tab can't receive messages (e.g. chrome:// page), fall through
      }
    }
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Eye strain care',
      message: 'Time for a quick eye-care break — blink, look away, check posture and brightness.',
    })
  },
}
