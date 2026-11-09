# Privacy Policy

This privacy policy aims to provide you with an understanding of how the website (recorder.appcloud.info) and the Chrome extension (Instant Tab Recorder) treat user data.

We place a high priority on protecting the privacy of our users and will not obtain, retain, or provide data unnecessarily.

For general terms and conditions governing the use of the Service, please refer to our [Terms of Service](TERMS.md).

## Data Collection

The Chrome extension does not collect analytics, crash reports, or usage metrics. It no longer generates a user identifier for tracking.

Recording data (video and audio) and transcription text are processed locally and are not uploaded by the extension. Recordings remain in local browser storage until you export or delete them.

Extension settings are stored using Chrome's own storage. If you have Chrome Sync enabled for extensions, Chrome synchronizes eligible settings through your Google account; this is handled entirely by Chrome and is subject to Google's privacy policy.

When you opt in to transcription, the extension downloads model data from Hugging Face. These network requests expose connection information, such as your IP address, to that service. Recording data and transcription text are not included in the downloads.

## Cookie

The extension does not directly use cookies. External services may handle cookies according to their own policies.

## External Services

No external services are used for analytics, crash reporting, or usage monitoring.

Earlier versions used [Sentry](https://sentry.io/privacy/) for crash reports and usage metrics. Sentry has been removed, along with the Bug Tracking setting and the Feedback feature that depended on it.

- [Hugging Face](https://huggingface.co/privacy)
  - Purpose: Used to retrieve model data required to use the transcription feature.
  - Added in Chrome extension v1.8.0.
  - Model data will be downloaded when you opt in via Options Page => Settings.
  - Please refer to its privacy policy for information about data collected during these requests.

## Privacy Policy Revisions

This Privacy Policy may be revised from time to time.
Revised versions will be posted on this site.

### Revision History

- 2024-06-22: Enacted
- 2026-02-10: Revised (updated Sentry opt-out instructions, added other configuration items to data collection)
- 2026-09-04: Revised (updated upon release of Terms of Service)
- 2026-09-09: Revised (clarified data handling for transcription feature, clarified independence from Terms of Service)
- 2026-11-09: Revised (removed Sentry tracking and clarified local processing, settings sync, and optional model downloads)
