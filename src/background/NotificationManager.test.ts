import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationManager } from './NotificationManager'

describe('NotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends message to active tab', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(chrome.tabs.query as any).mockResolvedValue([{ id: 1 } as chrome.tabs.Tab])
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined)

    await NotificationManager.deliver('Stay focused!')

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'SHOW_MINDFUL_CHECKIN',
      payload: { message: 'Stay focused!', stats: '' }
    })
  })

  it('falls back to system notification when no active tab', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(chrome.tabs.query as any).mockResolvedValue([])

    await NotificationManager.deliver('Drink water')

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Drink water' })
    )
  })
})
