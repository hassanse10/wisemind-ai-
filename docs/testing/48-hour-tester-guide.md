# 48-hour tester guide

The cheapest test from the `/roast` verdict (2026-07-03): validate the
interruption-cadence assumption on 5-10 real people *before* writing a
word of Chrome Web Store marketing. This doc is the protocol — actually
running it requires real testers, which is on you, not something that can
be simulated.

## 1. Build a shareable package

```
npm run build
```

This produces `dist/` (already gitignored). To hand it to a tester who
isn't comfortable cloning the repo, zip it:

```
cd dist && zip -r ../wisemind-ai-test-build.zip . && cd ..
```

## 2. How testers install it (send them this)

1. Unzip `wisemind-ai-test-build.zip` somewhere.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**, select the unzipped folder.
5. Pin the WiseMind icon to the toolbar (optional but makes it visible).

That's it — no account, no setup. With the new defaults ([StorageManager.ts](../../src/shared/StorageManager.ts))
they'll get the break timer and eye-strain nudges only; wind-down and
posture/hydration nudges stay off unless they turn them on in Settings.

## 3. What to ask them to do

Just use their browser normally for 2 days. Don't prompt them to "try
features" — the whole point is observing organic reaction to unsolicited
interruptions, not a guided demo.

## 4. The exact questions to ask after 48 hours

Keep it to these — more than this and people stop answering honestly:

1. **Did anything interrupt you at a bad moment?** (If yes: what were you
   doing, and what popped up?)
2. **Did you turn anything off, or want to?** (Tests whether 2 default
   interventions is still too many, or the right number.)
3. **Did the install step give you pause?** (Tests the permission-trust
   objection the Contrarian and Logician personas raised — the
   `<all_urls>` prompt Chrome shows on load.)
4. **Would you keep this installed next week, uninstall it, or forget it
   exists?** (The real retention signal — "forget it exists" is a
   different failure mode than "uninstall," and worth distinguishing.)

## 5. What the answers mean

| Signal | Read it as |
|---|---|
| Multiple testers report a bad-moment interruption from the break timer or eye-strain nudge | The 2 remaining defaults are still too aggressive — lengthen the interval or make the overlay less intrusive (e.g. a corner toast instead of a full overlay) before publishing. |
| Testers hesitate at the install permission prompt | The PRIVACY.md / trust-first framing needs to be surfaced *before* install, not just in the store listing description — consider a plainer first-run note. |
| "Forget it exists" is the dominant answer | The problem isn't interruption fatigue, it's that the value isn't visible enough day-to-day — revisit whether the popup/dashboard surfaces anything worth checking in on. |
| Testers keep it installed and don't mention the reminders unprompted | Green light — the interventions are calibrated correctly. Proceed to store submission using the copy in [listing.md](../store/listing.md). |

Nothing in this repo can run this test for you — the next action is
literally sending the zip to 5-10 people you know and asking these four
questions in two days.
