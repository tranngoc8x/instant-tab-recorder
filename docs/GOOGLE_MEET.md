# Google Meet recording

Open a Google Meet meeting in Chrome and click the extension icon once. Before joining, this arms automatic recording for that meeting tab. The badge shows WAIT. Once the leave-call control is visible (you have joined), recording starts. Clicking the icon while already in the meeting starts immediately. Chrome requires invoking the extension for the tab; installing the extension alone cannot grant automatic tab capture.

There is no in-page UI; the toolbar badge/icon shows waiting (WAIT), recording, or an error (!). Click the extension again to cancel waiting or stop recording. Stopping does not automatically restart recording. Recording stops automatically when you leave the call (the leave control disappears for ~6s) or when the tab closes. Navigating the tab elsewhere does not stop it. Microphone capture follows your existing microphone setting; enable it to include your own voice. Meet capture uses audio-only and keeps meeting playback audible.

The meeting title, when available from the page title, becomes the displayed and downloaded filename with a timestamp. If Meet exposes only its meeting code, that code is used. Internal recording paths remain unchanged for database and migration compatibility. Existing recordings are unaffected.

## Implementation and validation

A Google Meet-only content script detects a visible leave-call button, reports state every two seconds, and renders a small status indicator. A service-worker controller stores the armed tab and meeting in session storage, serializes start attempts, ignores other tabs/meetings, and requires a fresh click after capture failure. Stream IDs are acquired only when recording starts because they expire within seconds.

Tests cover join detection, hidden/prejoin controls, title normalization, explicit arming, duplicate events, tab isolation, worker restart, failure handling, filename sanitization, metadata persistence, and download names. TypeScript, lint, Node/browser tests and the extension build are required. An actual signed-in Meet call remains a separate manual acceptance check because DOM fixtures cannot establish compatibility with every live Meet rollout.

## Loading this build

Run `npm run build`, then open `chrome://extensions` and reload the unpacked extension (folder: `extension`). Reload any existing Meet tabs so the new content script is installed. Pin the extension icon for convenient arming and stopping.

## Verification (2026-11-10)

TypeScript and lint passed. All 664 Node tests and 304 browser tests passed. The build succeeded and the generated Meet content script parses as a classic script (no unsupported module imports). Review corrections preserve the existing recording/pause badge and show paused state in the Meet banner. Live signed-in Google Meet capture has not been exercised in this workspace.

## Record prompt (2026-11-10)

On each Meet meeting page that is not already armed or recording, a prompt asks "Record this meeting?" with Record / Don't record buttons. With no answer within 3 seconds, Record is selected. Record only marks intent: the banner turns amber and asks for one extension-icon click. It cannot start capture by itself because Chrome grants `tabCapture` only after the extension is invoked (action icon, context menu, or shortcut). A spike in Chromium confirmed that a click inside the page fails with "Extension has not been invoked for the current page". The same constraint rules out a record button injected into the Meet toolbar. Clicking the icon then follows the existing flow: it arms before joining, or starts immediately when already in the call.

Verification: TypeScript, lint and format checks passed. All 972 tests passed. The build succeeded. A Chromium run with the built extension on a mocked Meet page showed the prompt, the countdown, and the auto-selected amber banner.

## Microsoft Teams (web) (2026-11-12)

Teams meetings opened in the browser (`teams.microsoft.com` / `teams.live.com`, `/light-meetings/` app reached from meeting links) use the same flow as Meet: record prompt, one extension-icon click, automatic start after joining, audio-only, upload to the recording upload API when the meeting recording ends. The Teams desktop app cannot be captured (tab capture only).

- Join detection: a usable `#hangup-button` / `data-tid="calling-hangup-main-button"` (taken from the live Teams bundle); the pre-join `prejoin-join-button` does not count.
- Title: tab title without "| Microsoft Teams", else `data-tid="call-title"`, else "Teams meeting".
- Teams uses one path for every meeting, so the armed session is per tab (`/teams-meeting`), cleared when the tab closes or leaves `/light-meetings/`.
- The signed-in Teams app (`/v2/`) is not covered.

Verification: 993 tests pass, tsc/lint/format OK, build OK, content script still a classic script. The built extension on the real `light-meetings/launch` page shows the prompt then the amber banner; `/v2/` shows nothing. A real joined Teams call has not been exercised.

## Meeting title and participants in the upload (2026-11-12)

- The gateway upload carries `title` (the meeting name used for the filename) and `participants` as query params, clipped to the gateway limits (200 / 50 × 100 code points).
- Participants: the content script keeps every name seen since joining (union, so early leavers stay); the service worker forwards the list to offscreen while recording; the latest list goes with the upload.
- Names come from rendered video tiles only: Meet `[data-participant-id] .notranslate`, Teams `[data-tid="participant-info-nametag"]` (from the live bundle). People never shown on screen in a large call are missed.
- Not yet checked in a real joined Meet or Teams call; selectors are covered by fixture tests only.

## Auto-stop on leave, prompt and banner removed (2026-11-12)

- The in-page "Record this meeting?" prompt and status banner were removed. The prompt could not start capture (Chrome only grants `tabCapture` from the extension icon / context menu / shortcut), so it only added a click that did nothing.
- Auto-stop: the content script reports `left` once it had joined and no leave control (Meet leave button / Teams `#hangup-button`) has been in the DOM for 3 reads in a row (~6s). Presence in the DOM, not visibility, so a modal hiding the toolbar does not stop the recording. Navigating the recorded tab off the meeting page does not stop it (by request); only leaving the call or closing the tab does. Trigger: `meeting-ended`, no timer confirmation.
- Before this, only closing the tab stopped a recording (tab capture track ended).

Verification: tsc, lint, 1002 tests, build OK, content script still classic. Not yet checked on a real Meet/Teams call.

## Skip short meetings (2026-11-12)

Settings → Recording upload API → "Minimum meeting length to upload" (`gateway.minMeetingMinutes`, default 3, range 0-600, 0 uploads every meeting). Shorter meeting recordings (measured without pauses) are kept locally but not uploaded. Device-only like the rest of the gateway settings (not synced). Verification: 1004 tests, tsc, lint, build OK.
