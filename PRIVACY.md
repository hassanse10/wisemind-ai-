# WiseMind AI — Privacy Policy

_Last updated: 2026-07-03_

## The short version

WiseMind AI runs entirely on your device. It does not have a server. It does
not send your browsing data anywhere, ever — with one narrow, opt-in
exception (the AI coach panel), described below.

## What the extension tracks, and where it's stored

To compute your daily Health/Productivity/Learning scores and power the
break/eye-care/wind-down reminders, WiseMind AI locally records:

- The domain (not full URL) and category of pages you visit, and how long
  each page is open.
- Short-video view counts on supported sites (used for the "Shorts today"
  counter).
- Your own settings (reminder intervals, enabled features, theme, etc.).

All of this is stored in your browser's local storage and local IndexedDB
database (`chrome.storage.local` / an on-device database), scoped to your
own browser profile. **None of it is transmitted off your device by this
extension.** There is no WiseMind AI server, no account system, and no
analytics or telemetry of any kind.

**Private Mode** (toggle in the popup or Settings) pauses all tracking
on demand — no data is recorded while it's active.

**Excluded domains** (Settings) can be configured to never be tracked at
all.

## The one exception: the optional AI coach

WiseMind AI includes an optional AI coaching panel. It is off by default —
you have to add your own OpenRouter API key in Settings to turn it on.

If, and only if, you enable this and it fires a coaching message, the
extension sends a small, aggregated snapshot directly from your browser to
OpenRouter's API (`openrouter.ai`) using **your own key**:
your current activity **category** (e.g. "social," "work" — not the actual
domain or URL), how many continuous minutes you've been browsing, your
short-video count for the day, and whether it's late at night. That request
goes straight to OpenRouter, not through any WiseMind AI server, because
there isn't one. OpenRouter's handling of that request is governed by
[OpenRouter's own privacy policy](https://openrouter.ai/privacy) — review it
if you plan to use this feature.

If you never add an API key, this code path never runs and nothing is ever
sent anywhere.

## Permissions this extension requests, and why

See the permission justification table in
[`docs/store/listing.md`](docs/store/listing.md) for the plain-language
reason behind each permission (`<all_urls>`, `tabs`, `webNavigation`,
`scripting`, `idle`, `alarms`, `notifications`, `storage`, `sidePanel`).
None of them are used to transmit data off your device — they're used to
read the active tab's domain and inject the on-page reminder UI locally.

## Data deletion

Uninstalling the extension deletes all locally stored data along with it.
You can also clear it at any time via Chrome's extension storage settings,
or by clearing individual fields from the Settings page in the extension.

## Changes to this policy

If this policy changes, the "Last updated" date above will change, and the
new terms will apply from that date. Given this extension does no server-side
data collection, changes here are expected to be rare and to track actual
changes in what the code does.

## Contact

This is an independently developed, free extension. Questions or concerns
about privacy can be raised via the project's repository (see the
extension's store listing for the current link).
