import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationManager } from './NotificationManager'

vi.mock('../shared/messaging', () => ({ sendMessage: vi.fn() }))

import { sendMessage } from '../shared/messaging'

beforeEach(() => vi.clearAllMocks())

describe('NotificationManager.deliver', () => {
  it('sends SHOW_MINDFUL_CHECKIN message', () => {
    const nm = new NotificationManager()
    nm.deliver('Take a break', 'You have been browsing for 90 minutes')
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'SHOW_MINDFUL_CHECKIN',
      payload: { message: 'Take a break', stats: 'You have been browsing for 90 minutes' },
    })
  })

  it('falls back to chrome.notifications when content script unavailable', () => {
    const nm = new NotificationManager()
    vi.mocked(sendMessage).mockImplementationOnce(() => { throw new Error('no receiver') })
    nm.deliver('Drink water')
    expect(chrome.notifications.create).toHaveBeenCalled()
  })
})
