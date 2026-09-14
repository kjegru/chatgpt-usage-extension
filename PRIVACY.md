# Privacy Policy — Usage Limits Tracker for ChatGPT

**Last updated:** 2026-09-14

## Overview

Usage Limits Tracker for ChatGPT is a third-party browser extension that displays your ChatGPT usage quota information directly in the Chrome toolbar and on the ChatGPT page. It is not affiliated with, endorsed by, or associated with OpenAI.

---

## Data We Access

The extension accesses the following data **solely to display your quota information**:

| Data | How it is accessed | Why |
|---|---|---|
| ChatGPT usage metrics (% used, time-to-reset) | Read from `https://chatgpt.com/backend-api/wham/usage` using your existing session | To display your 5-hour and weekly limits |
| Session auth token | Fetched from `https://chatgpt.com/api/auth/session` to authenticate the usage request | Required to call the usage API |

---

## Data Storage

- **Usage metrics** (percentage used, reset times) are stored **locally on your device** using `chrome.storage.local`. This data never leaves your browser.
- **The session auth token is never stored.** It is held in memory only for the duration of a single API call, then discarded.
- **No user-identifying information** (email, name, account ID) is accessed, read, or stored.

---

## Data We Do NOT Collect

- ❌ No personal information
- ❌ No conversation content or history
- ❌ No account credentials or passwords
- ❌ No analytics or telemetry
- ❌ No crash reporting
- ❌ No advertising or tracking

---

## Third-Party Data Sharing

**We share no data with any third party.** The extension makes no network requests other than to `chatgpt.com` (using your existing authenticated session). No data is sent to any external server, analytics platform, or advertising network.

---

## Network Requests

The extension makes periodic requests to the following ChatGPT endpoints (using your existing login session cookies):

- `https://chatgpt.com/api/auth/session` — to obtain a temporary auth token
- `https://chatgpt.com/backend-api/wham/usage` — to read your usage quota

These are read-only requests. The extension does not post, create, modify, or delete any data on your account.

---

## Data Retention & Deletion

Usage data cached in `chrome.storage.local` is automatically replaced on each refresh. You can clear all stored data at any time by uninstalling the extension, or by clearing extension storage in Chrome's developer tools.

---

## Changes to This Policy

If this policy changes materially, the extension version number will be incremented and the "Last updated" date above will reflect the change.

---

## Contact

For questions or concerns, please open an issue in the project repository.
