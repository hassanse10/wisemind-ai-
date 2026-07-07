# Chrome Web Store listing

Copy for the WiseMind AI store page. Trust-first framing per the RESHAPE verdict from
`/roast` (2026-07-03): three of five council personas flagged the `<all_urls>` +
`tabs` + `webNavigation` permission set as the biggest adoption risk for a
no-name, unmonetized extension. The listing has to earn trust before anyone
reads the feature list.

## Short description (manifest.json, ≤132 chars)

> 100% local, open-source wellness coach: screen time, eye-care & break reminders. Nothing you browse leaves your device.

(119 chars — already applied to `public/manifest.json`.)

## Single purpose description (required by CWS review)

> WiseMind AI helps users manage digital wellness by locally tracking their own
> browsing activity and screen time, then delivering timed break, eye-care,
> and bedtime reminders based on that local data.

## Detailed description

> **Everything stays on your device. Nothing is free with your data.**
>
> WiseMind AI is a free digital wellness extension. It watches your own
> screen time and browsing categories — entirely inside your browser — and
> turns that into a few simple, deterministic reminders:
>
> - **Break timer** — a gentle nudge to step away after a set number of
>   minutes of continuous use.
> - **Eye-strain care** — a 4-step guided reset (blink, look away, check
>   posture, check brightness) for dry eyes and screen fatigue.
> - **Bedtime wind-down** — an optional evening reminder (and optional warm
>   screen tint) as your bedtime approaches. Off by default; turn it on in
>   Settings.
> - **Posture & hydration nudges** — optional periodic reminders. Off by
>   default; turn it on in Settings.
> - **Breathing reset** — a short guided breathing exercise, one click away.
>
> **No account. No servers. No analytics.** Your browsing data is computed
> and stored locally in your browser and is never transmitted anywhere by
> this extension.
>
> **Optional AI coach.** If you want richer, personalized suggestions, you
> can add your own OpenRouter API key in Settings to enable an AI coaching
> panel. This is entirely optional — the extension is fully useful without
> it, and no key is required for any of the core features above.
>
> **Free. No ads, no subscription, no upsell.**
>
> **Open source.** The full source is public on GitHub — read the code,
> file an issue, or verify for yourself that nothing leaves your device:
> github.com/hassanse10/wisemind-ai-
>
> See our Privacy Policy for the full, plain-language breakdown of what data
> this extension touches and where it goes (short answer: nowhere but your
> own device).

## Permission justifications (Chrome Web Store Developer Dashboard → Privacy practices tab)

Each of these must be filled in as free-text justification when submitting.

| Permission | Justification |
|---|---|
| `host_permissions: <all_urls>` | Needed so the extension can measure time-on-page and categorize the domain locally on any site the user visits, and to show the optional on-page break/eye-care overlay when the user has enabled it. No page content is read or transmitted — only the domain and a timestamp are used, and both stay in local storage. |
| `tabs` | Needed to detect which tab is currently active and its URL/domain, so time can be attributed to the correct site locally. |
| `webNavigation` | Needed to detect navigation events (page loads, tab switches) so per-domain time tracking stays accurate as the user browses. |
| `scripting` | Needed to inject the wellness overlay UI (break/eye-care/wind-down cards) into the current page when a reminder fires. |
| `idle` | Needed to pause time tracking when the user is away or the screen is locked, so idle time isn't counted as screen time. |
| `alarms` | Needed to schedule the periodic local checks that drive the break timer, wind-down, and nudge reminders. |
| `notifications` | Needed to show system notifications for bedtime wind-down reminders. |
| `storage` | Needed to persist user settings and locally computed daily summaries. |
| `sidePanel` | Needed to host the optional AI coaching panel. |

## Privacy practices disclosures (CWS form)

- **Does this extension collect or use user data?** Yes — browsing history
  (URLs/domains visited) and activity timestamps, used solely to compute
  local screen-time statistics. Not sold, not transmitted, not shared with
  any third party by this extension.
- **Certify data usage compliance:** Yes — all processing is local; the
  optional AI panel only sends data off-device if the user supplies their
  own API key and explicitly uses that panel, directly to the AI provider
  the user configured, not to any server operated by this extension.
- **Privacy policy URL:**
  `https://raw.githubusercontent.com/hassanse10/wisemind-ai-/master/PRIVACY.md`

## Open source

The repo is public: github.com/hassanse10/wisemind-ai- (MIT licensed, see
`LICENSE`). The "open source" claim in the short/detailed description above
is backed by this — the code really is inspectable by anyone, which is what
makes the "nothing leaves your device" claim verifiable rather than just
asserted.
