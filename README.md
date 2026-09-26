# Usage Limits Tracker for ChatGPT

A lightweight Chrome extension (Manifest V3) that tracks and displays your ChatGPT usage quota (5-hour and weekly limits) in the toolbar icon badge, popup, and an optional on-page floating HUD.

## Features

- **Toolbar Badge**: At-a-glance status indicator and percentage remaining in the browser toolbar.
- **Popup Dashboard**: Click the extension icon to view detailed 5-hour and weekly quota usage, remaining allowances, and reset timers.
- **On-Page Floating Widget**: Draggable, collapsible HUD overlay directly on `chatgpt.com`.
- **Customizable Scaling**: Adjust widget scale and font size with two-way synchronized settings.
- **Privacy-Focused**: Communicates only with official ChatGPT endpoints using your existing session. No third-party servers, analytics, or tracking (see [PRIVACY.md](PRIVACY.md)).

---

## Development & Testing

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)

### Run Tests & Syntax Checks

```bash
# Run unit tests
npm test

# Check syntax across scripts
npm run check:syntax
```

### Load Unpacked Extension (Local Development)

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select this project repository directory.

---

## Building for Chrome Web Store

The Chrome Web Store requires your extension source files packaged into a `.zip` archive with `manifest.json` at the root.

### Build Package

To build the release archive:

```bash
npm run build
```

This runs the packaging command defined in `package.json` and outputs:

```
dist/chatgpt-usage-extension.zip
```

### What This Does

- Packages all runtime extension assets:
  - `manifest.json`
  - `background.js`
  - `content.js` & `content.css`
  - `popup.html`, `popup.js`, & `popup.css`
  - `utils.js` & `data_schema.js`
  - `icons/`
- Automatically excludes test suites, Git files, mock JSON fixtures, and developer configuration files.
- Places `manifest.json` directly at the root of the ZIP file as required by Google.

### Uploading to Chrome Web Store

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **New Item** (or select your existing extension).
3. Upload `dist/chatgpt-usage-extension.zip`.
4. Complete the store listing and privacy justifications, then submit for review.
