import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from './App'

const mockUpdateSettings = vi.fn()

vi.mock('../shared/hooks/useStorage', () => ({
  useSettings: () => ({
    openrouterApiKey: '',
    selectedModel: 'openai/gpt-4o-mini',
    mentorPersonality: 'wise',
    theme: 'system',
    coachingEnabled: true,
    coachingFrequency: 'moderate',
    coachingHours: { start: 9, end: 22 },
    excludedDomains: [],
    privateModeActive: false,
    eyeHealthReminders: true,
    breakIntervalMinutes: 45,
    lastHealthScore: 0,
    todaysSummary: null,
    achievements: [],
    ruleLastFired: {},
  }),
}))

vi.mock('../shared/StorageManager', () => ({
  updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
}))

beforeEach(() => {
  mockUpdateSettings.mockClear()
})

describe('Settings App', () => {
  it('renders API key input', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/sk-or-/i)).toBeInTheDocument()
  })

  it('API key input is type="password" to keep key masked', () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/sk-or-/i)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('renders personality selector', () => {
    render(<App />)
    expect(screen.getByText('Wise Mentor')).toBeInTheDocument()
  })

  it('renders all five personality options', () => {
    render(<App />)
    expect(screen.getByText('Wise Mentor')).toBeInTheDocument()
    expect(screen.getByText('Friendly Friend')).toBeInTheDocument()
    expect(screen.getByText('Tough Coach')).toBeInTheDocument()
    expect(screen.getByText('Mindfulness Guide')).toBeInTheDocument()
    expect(screen.getByText('Funny Companion')).toBeInTheDocument()
  })

  it('calls updateSettings when API key saved', () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/sk-or-/i)
    fireEvent.change(input, { target: { value: 'sk-or-test' } })
    fireEvent.click(screen.getByText('Save'))
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ openrouterApiKey: 'sk-or-test' })
    )
  })

  it('shows saved confirmation after saving API key', async () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/sk-or-/i)
    fireEvent.change(input, { target: { value: 'sk-or-new' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  })

  it('calls updateSettings when personality card clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Friendly Friend'))
    expect(mockUpdateSettings).toHaveBeenCalledWith({ mentorPersonality: 'friendly' })
  })

  it('renders model selector', () => {
    render(<App />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders coaching enabled checkbox', () => {
    render(<App />)
    expect(screen.getByText('Enable Coaching')).toBeInTheDocument()
  })

  it('renders eye health reminders toggle', () => {
    render(<App />)
    expect(screen.getByText('Enable break reminders')).toBeInTheDocument()
  })

  it('calls updateSettings when eye health toggled', () => {
    render(<App />)
    const checkboxes = screen.getAllByRole('checkbox')
    // Eye health checkbox is in the Break Reminders section, labelled "Enable break reminders"
    const eyeCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Enable break reminders')
    })
    if (eyeCheckbox) {
      fireEvent.click(eyeCheckbox)
      expect(mockUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ eyeHealthReminders: expect.any(Boolean) })
      )
    }
  })

  it('renders private mode toggle', () => {
    render(<App />)
    expect(screen.getByText('Private Mode')).toBeInTheDocument()
  })

  it('calls updateSettings with privateModeActive toggled when private mode changed', () => {
    render(<App />)
    const checkboxes = screen.getAllByRole('checkbox')
    const privateCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label')
      return label?.textContent?.includes('Private Mode')
    })
    if (privateCheckbox) {
      fireEvent.click(privateCheckbox)
      expect(mockUpdateSettings).toHaveBeenCalledWith({ privateModeActive: true })
    }
  })

  it('renders theme selector with light, dark, system buttons', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'system' })).toBeInTheDocument()
  })

  it('calls updateSettings when theme button clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'dark' }))
    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark' })
  })

  it('renders excluded domains input', () => {
    render(<App />)
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument()
  })

  it('renders Add button for domain exclusions', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('calls updateSettings with new domain when Add clicked', () => {
    render(<App />)
    const domainInput = screen.getByPlaceholderText('example.com')
    fireEvent.change(domainInput, { target: { value: 'facebook.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ excludedDomains: expect.arrayContaining(['facebook.com']) })
    )
  })

  it('renders coaching frequency options', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Minimal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moderate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
  })

  it('renders Clear Data button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Clear Data' })).toBeInTheDocument()
  })

  it('shows confirmation dialog when Clear Data clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Data' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/This will permanently delete/i)).toBeInTheDocument()
  })

  it('hides confirmation dialog when Cancel clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Data' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders Export Data button', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument()
  })

  it('renders coaching hours inputs', () => {
    render(<App />)
    const numberInputs = screen.getAllByRole('spinbutton')
    expect(numberInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('calls updateSettings when coaching hours changed', () => {
    render(<App />)
    const numberInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(numberInputs[0], { target: { value: '8' } })
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ coachingHours: expect.objectContaining({ start: 8 }) })
    )
  })

  it('updates the break interval when a preset is clicked', async () => {
    render(<App />)
    const btn = await screen.findByRole('button', { name: '60 min' })
    fireEvent.click(btn)
    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ breakIntervalMinutes: 60 })
    )
  })
})
