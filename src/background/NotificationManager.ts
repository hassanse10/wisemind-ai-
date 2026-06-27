import { sendMessage } from '../shared/messaging'

export class NotificationManager {
  deliver(message: string, stats: string = ''): void {
    try {
      sendMessage({ type: 'SHOW_MINDFUL_CHECKIN', payload: { message, stats } })
    } catch {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'WiseMind AI',
        message,
      })
    }
  }
}
