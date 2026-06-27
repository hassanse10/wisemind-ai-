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
  }
}
