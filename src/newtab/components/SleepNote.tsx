import type { DailySummary, ExtensionSettings } from '../../shared/types'

interface Props {
  summary: DailySummary
  settings: ExtensionSettings
}

function hhmm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function SleepNote({ summary, settings }: Props) {
  const lateMin = Math.round(summary.lateNightMinutes)
  const deduction = Math.min(20, Math.floor(lateMin / 10) * 2)
  const note =
    lateMin === 0
      ? 'No late-night screen time today — your sleep thanks you.'
      : `${lateMin} min after 11 PM today${deduction > 0 ? ` (−${deduction} to Health)` : ''}. Easing off earlier helps you fall asleep faster.`

  return (
    <div className="wm-panel p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm text-ink-200">Sleep &amp; Wind-Down</h3>
        <span className="text-[11.5px] text-ink-500">
          {settings.windDownEnabled
            ? `${hhmm(settings.windDownStart)} → ${hhmm(settings.windDownBedtime)}`
            : 'reminders off'}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-400">{note}</p>
    </div>
  )
}
