import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { App } from './App'

// Mock scrollIntoView which is not implemented in jsdom
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: vi.fn(() => ({
    openrouterApiKey: 'test-key',
    selectedModel: 'openai/gpt-4o-mini',
    mentorPersonality: 'wise',
    lastHealthScore: 75,
    privateModeActive: false,
    breakIntervalMinutes: 45,
  })),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SidePanel App', () => {
  it('renders quick prompt chips', () => {
    render(<App />)
    expect(screen.getByText(/How am I doing/i)).toBeInTheDocument()
  })

  it('shows input field', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/Ask your coach/i)).toBeInTheDocument()
  })

  it('shows health score in header', () => {
    render(<App />)
    expect(screen.getByText(/75\/100/i)).toBeInTheDocument()
  })

  it('shows personality intro message for wise mentor', () => {
    render(<App />)
    expect(screen.getByText(/Wise Mentor/i)).toBeInTheDocument()
  })

  it('shows send button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: '→' })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<App />)
    const sendBtn = screen.getByRole('button', { name: '→' })
    expect(sendBtn).toBeDisabled()
  })

  it('send button becomes enabled when user types', async () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i)
    fireEvent.change(input, { target: { value: 'Hello coach' } })
    const sendBtn = screen.getByRole('button', { name: '→' })
    expect(sendBtn).not.toBeDisabled()
  })

  it('appends user message to chat thread on send', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Great question!' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i)
    // unique text so it doesn't collide with a quick-prompt chip of the same label
    fireEvent.change(input, { target: { value: 'Tell me about my day' } })
    fireEvent.click(screen.getByRole('button', { name: '→' }))

    expect(screen.getByText('Tell me about my day')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Great question!')).toBeInTheDocument())
  })

  it('calls OpenRouter API with correct headers and payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'Response' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i)
    fireEvent.change(input, { target: { value: 'Test message' } })
    fireEvent.click(screen.getByRole('button', { name: '→' }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(opts.headers['Authorization']).toBe('Bearer test-key')
    const body = JSON.parse(opts.body)
    expect(body.model).toBe('openai/gpt-4o-mini')
  })

  it('shows connection error message when fetch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i)
    fireEvent.change(input, { target: { value: 'Hi' } })
    fireEvent.click(screen.getByRole('button', { name: '→' }))

    await waitFor(() =>
      expect(screen.getByText(/Connection error/i)).toBeInTheDocument()
    )
  })

  it('clears input after sending', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'OK' } }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: '→' }))

    expect(input.value).toBe('')
  })

  it('shows typing indicator while loading', async () => {
    // Mock fetch that never resolves (to keep loading state)
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}))
    vi.stubGlobal('fetch', mockFetch)

    render(<App />)
    const input = screen.getByPlaceholderText(/Ask your coach/i)
    fireEvent.change(input, { target: { value: 'Hello' } })
    // Click the send button (still shows → before loading starts)
    fireEvent.click(screen.getByRole('button', { name: '→' }))

    // After send, loading state begins — check for thinking indicator
    await waitFor(() => expect(screen.getByText(/Coach is thinking/i)).toBeInTheDocument())
  })
})

describe('SidePanel App — private mode', () => {
  it('shows private mode message when privateModeActive is true', async () => {
    const { useSettings } = await import('../shared/hooks/useStorage')
    vi.mocked(useSettings).mockReturnValue({
      openrouterApiKey: 'test-key',
      selectedModel: 'openai/gpt-4o-mini',
      mentorPersonality: 'wise',
      lastHealthScore: 75,
      privateModeActive: true,
      theme: 'dark',
      coachingEnabled: true,
      coachingFrequency: 'moderate',
      coachingHours: { start: 9, end: 21 },
      excludedDomains: [],
      eyeHealthReminders: false,
      breakIntervalMinutes: 45,
      windDownEnabled: true,
      windDownTintEnabled: false,
      windDownStart: 1290,
      windDownBedtime: 1380,
      todaysSummary: null,
      achievements: [],
      ruleLastFired: {},
    })

    render(<App />)
    expect(screen.getByText(/Private Mode Active/i)).toBeInTheDocument()

    // Reset back to default mock
    vi.mocked(useSettings).mockReturnValue({
      openrouterApiKey: 'test-key',
      selectedModel: 'openai/gpt-4o-mini',
      mentorPersonality: 'wise',
      lastHealthScore: 75,
      privateModeActive: false,
      theme: 'dark',
      coachingEnabled: true,
      coachingFrequency: 'moderate',
      coachingHours: { start: 9, end: 21 },
      excludedDomains: [],
      eyeHealthReminders: false,
      breakIntervalMinutes: 45,
      windDownEnabled: true,
      windDownTintEnabled: false,
      windDownStart: 1290,
      windDownBedtime: 1380,
      todaysSummary: null,
      achievements: [],
      ruleLastFired: {},
    })
  })
})

describe('SidePanel App — no API key', () => {
  it('shows warning when no API key is configured', async () => {
    const { useSettings } = await import('../shared/hooks/useStorage')
    vi.mocked(useSettings).mockReturnValue({
      openrouterApiKey: '',
      selectedModel: 'openai/gpt-4o-mini',
      mentorPersonality: 'wise',
      lastHealthScore: 75,
      privateModeActive: false,
      theme: 'dark',
      coachingEnabled: true,
      coachingFrequency: 'moderate',
      coachingHours: { start: 9, end: 21 },
      excludedDomains: [],
      eyeHealthReminders: false,
      breakIntervalMinutes: 45,
      windDownEnabled: true,
      windDownTintEnabled: false,
      windDownStart: 1290,
      windDownBedtime: 1380,
      todaysSummary: null,
      achievements: [],
      ruleLastFired: {},
    })

    render(<App />)
    expect(screen.getByText(/OpenRouter API key/i)).toBeInTheDocument()

    // Reset
    vi.mocked(useSettings).mockReturnValue({
      openrouterApiKey: 'test-key',
      selectedModel: 'openai/gpt-4o-mini',
      mentorPersonality: 'wise',
      lastHealthScore: 75,
      privateModeActive: false,
      theme: 'dark',
      coachingEnabled: true,
      coachingFrequency: 'moderate',
      coachingHours: { start: 9, end: 21 },
      excludedDomains: [],
      eyeHealthReminders: false,
      breakIntervalMinutes: 45,
      windDownEnabled: true,
      windDownTintEnabled: false,
      windDownStart: 1290,
      windDownBedtime: 1380,
      todaysSummary: null,
      achievements: [],
      ruleLastFired: {},
    })
  })
})

describe('SidePanel App — achievement toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function getOnMessageListener() {
    const calls = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls
    // Return the most recently registered listener
    const lastCall = calls[calls.length - 1]
    return lastCall?.[0] as ((msg: unknown) => void) | undefined
  }

  it('does not show a toast initially (before any message)', () => {
    render(<App />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows achievement toast when ACHIEVEMENT_UNLOCKED message arrives with deep_learner', () => {
    render(<App />)

    const listener = getOnMessageListener()
    expect(listener).toBeDefined()

    act(() => {
      listener!({ type: 'ACHIEVEMENT_UNLOCKED', payload: { ids: ['deep_learner'] } })
    })

    expect(screen.getByText(/Achievement unlocked: Deep Learner/i)).toBeInTheDocument()
  })

  it('auto-dismisses the toast after 5 seconds', () => {
    render(<App />)

    const listener = getOnMessageListener()
    act(() => {
      listener!({ type: 'ACHIEVEMENT_UNLOCKED', payload: { ids: ['deep_learner'] } })
    })

    expect(screen.getByText(/Achievement unlocked: Deep Learner/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText(/Achievement unlocked: Deep Learner/i)).not.toBeInTheDocument()
  })

  it('can be manually dismissed via the close button', () => {
    render(<App />)

    const listener = getOnMessageListener()
    act(() => {
      listener!({ type: 'ACHIEVEMENT_UNLOCKED', payload: { ids: ['balanced_day'] } })
    })

    expect(screen.getByText(/Achievement unlocked: Balanced Day/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dismiss achievement/i }))

    expect(screen.queryByText(/Achievement unlocked: Balanced Day/i)).not.toBeInTheDocument()
  })
})
