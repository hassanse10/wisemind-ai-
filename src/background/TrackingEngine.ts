import { v4 as uuid } from 'uuid'
import type { ActiveSession, Visit } from '../shared/types'
import { getDomainFromUrl, DOMAIN_MAP } from '../shared/constants'
import { addVisit } from '../shared/db'
import { isPrivateMode, isDomainExcluded } from '../shared/StorageManager'

const MIN_SESSION_SECONDS = 5

export class TrackingEngine {
  private activeSession: ActiveSession | null = null

  init(): void {
    chrome.tabs.onActivated.addListener(info => this.handleTabActivated(info))
    chrome.webNavigation.onCompleted.addListener(details => {
      if (details.frameId === 0) this.handleNavigation(details)
    })
    chrome.idle.onStateChanged.addListener(state => this.handleIdle(state))
    chrome.windows.onFocusChanged.addListener(id => this.handleWindowFocus(id))
  }

  private async handleTabActivated(info: chrome.tabs.TabActiveInfo): Promise<void> {
    await this.endSession()
    const tab = await chrome.tabs.get(info.tabId).catch(() => null)
    if (tab?.url) {
      await this.startSession(info.tabId, tab.url, tab.title ?? '')
    }
  }

  private async handleNavigation(
    details: chrome.webNavigation.WebNavigationFramedCallbackDetails
  ): Promise<void> {
    await this.endSession()
    const tab = await chrome.tabs.get(details.tabId).catch(() => null)
    if (tab?.url) {
      await this.startSession(details.tabId, details.url, tab.title ?? '')
    }
  }

  private async handleIdle(state: string): Promise<void> {
    if (state === 'idle' || state === 'locked') {
      await this.endSession()
    }
  }

  private async handleWindowFocus(windowId: number): Promise<void> {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await this.endSession()
    }
  }

  private async startSession(tabId: number, url: string, title: string): Promise<void> {
    if (!url.startsWith('http')) return
    const domain = getDomainFromUrl(url)
    if (await isDomainExcluded(domain)) return
    this.activeSession = { tabId, url, domain, title, startTime: Date.now() }
  }

  private async endSession(): Promise<void> {
    if (!this.activeSession) return
    if (await isPrivateMode()) { this.activeSession = null; return }

    const session = this.activeSession
    this.activeSession = null
    const endTime = Date.now()
    const duration = Math.round((endTime - session.startTime) / 1000)

    if (duration < MIN_SESSION_SECONDS) return

    const category = DOMAIN_MAP[session.domain] ?? 'other'
    const visit: Visit = {
      id: uuid(),
      url: session.url,
      domain: session.domain,
      title: session.title,
      startTime: session.startTime,
      endTime,
      duration,
      category,
      aiCategory: '',
      classified: category !== 'other',
    }
    await addVisit(visit)
  }
}
