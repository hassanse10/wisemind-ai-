import type { ExtensionMessage } from './types'

export function sendMessage(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message)
}

export function onMessage(
  handler: (message: ExtensionMessage, sender: chrome.runtime.MessageSender) => void
): void {
  chrome.runtime.onMessage.addListener((msg, sender) => {
    handler(msg as ExtensionMessage, sender)
  })
}
