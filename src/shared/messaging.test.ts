import { describe, it, expect, vi } from 'vitest'
import { sendMessage, onMessage } from './messaging'

describe('sendMessage', () => {
  it('calls chrome.runtime.sendMessage with the message', () => {
    sendMessage({ type: 'SCORE_UPDATE', payload: { health: 80, productivity: 70, learning: 60 } })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SCORE_UPDATE',
      payload: { health: 80, productivity: 70, learning: 60 },
    })
  })
})

describe('onMessage', () => {
  it('registers a listener on chrome.runtime.onMessage', () => {
    const handler = vi.fn()
    onMessage(handler)
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function))
  })
})
