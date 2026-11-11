# Google Meet recording

Open a Google Meet meeting in Chrome and click the extension icon once. Before joining, this arms automatic recording for that meeting tab. The badge shows WAIT. Once the leave-call control is visible (you have joined), recording starts. Clicking the icon while already in the meeting starts immediately. Chrome requires invoking the extension for the tab; installing the extension alone cannot grant automatic tab capture.

The in-page status shows waiting, recording, or an error. Click the extension again to cancel waiting or stop recording. Stopping does not automatically restart recording. Recording ends when you close the captured tab; leaving a call without closing the tab still requires stopping the recording. Microphone capture follows your existing microphone setting; enable it to include your own voice. Meet capture uses audio-only and keeps meeting playback audible.

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
