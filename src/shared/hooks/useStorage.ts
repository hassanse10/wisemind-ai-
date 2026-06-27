import { useState, useEffect } from 'react'
import type { ExtensionSettings } from '../types'
import { getSettings } from '../StorageManager'

export function useSettings(): ExtensionSettings | null {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)

  useEffect(() => {
    getSettings().then(setSettings)

    const listener = () => getSettings().then(setSettings)
    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [])

  return settings
}
