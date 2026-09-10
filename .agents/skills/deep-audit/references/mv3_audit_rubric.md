# Chrome Extension (Manifest V3) Audit Rubric

When auditing this codebase, examine the following critical areas:

## 1. Background Service Worker Lifecycle
- **Dormancy Resets**: Service workers can terminate after 30 seconds of inactivity. In-memory global variables will be reset.
- **Alarm Resilience**: Periodic intervals (`setInterval`) will stop when the worker suspends. Use `chrome.alarms` for background tasks that must survive suspension.
- **Listener Registrations**: All top-level `chrome.*.on<Event>` listeners must be registered synchronously in the root scope of `background.js`, not inside asynchronous callbacks.

## 2. Chrome Storage (`chrome.storage.local`)
- **Async Concurrency**: Ensure read-modify-write patterns don't race. If multiple updates occur simultaneously, use atomic operations or guard flags.
- **Quota & Data Integrity**: Check that stored values match expected schemas (`data_schema.js`) and handle `chrome.runtime.lastError` or missing keys gracefully.

## 3. Message Passing (`runtime.sendMessage` / `tabs.sendMessage`)
- **Async Responses**: If `chrome.runtime.onMessage.addListener` uses an asynchronous `sendResponse`, it must explicitly `return true;`.
- **Port Disconnections**: Check for `The message port closed before a response was received` errors when tabs close or are unloaded.

## 4. Content Script DOM & Security
- **XSS Prevention**: Never inject untrusted data using `element.innerHTML`. Prefer `element.textContent`, `element.setAttribute()`, or `DOMPurify`.
- **Selector Fragility**: `chatgpt.com` updates its DOM structure frequently. Verify selector fallbacks and null checks before calling DOM properties.
- **MutationObserver Cleanup**: Ensure observers disconnect if overlay elements are removed or recreated.

## 5. UI & Badge Consistency
- **Character Limits**: Action badges support a maximum of 4 characters. Ensure badge text is truncated or formatted properly (e.g., `5:XX`, `w:XX`).
- **Interval Timers**: Ensure badge cycling intervals are cleared when not in use to prevent battery drain.
