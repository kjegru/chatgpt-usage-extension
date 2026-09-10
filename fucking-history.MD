  Evaluating popup.js code duplication
   Code Quality, Architecture & Security Audit Checklist

  An exhaustive review of the codebase was conducted against the Chrome Extension Manifest V3
  specification, Modern JavaScript standards, and security best practices. Below is the structured
  checklist of findings, race conditions, lifecycle bugs, and architectural flaws, complete with drop-in
  replacements.
  ──────
  ### Summary of Findings

   #  | File & Location        | Seve… | Category       | Flaw Summary
  ----|------------------------|-------|----------------|-------------------------------------------------
   1  | content.js:96-104      | Criti | UI State Bug   | Minimized widget header title is never updated
      |                        | cal / |                | when toggling minimize mode
      |                        | High  |                |
   2  | background.js:15-16,   | High  | Lifecycle &    | Service worker dormancy halts badge cycling;
      | background.js:179-185  |       | Perf           | polling chrome.storage.local every 3.5s drains
      |                        |       |                | I/O
   3  | background.js:199-219, | High  | Messaging /    | refreshUsage suppresses errors and always
      | background.js:256-261  |       | Error Handling | responds { ok: true }, masking failures
   4  | popup.js:136-165       | High  | Race Condition | Stale data shown when refresh fails; refresh
      |                        |       | / UX           | button can be spammed without debounce
   5  | manifest.json:13-15    | Mediu | Architecture   | Missing "type": "module" in background prevents
      |                        | m     |                | ES imports and caused duplicated logic
   6  | content.js:41-45,      | Mediu | SPA DOM        | Cached widgetEl is detached during SPA
      | content.js:114-116     | m     | Fragility      | navigations on ChatGPT
   7  | background.js:199-203  | Mediu | Concurrency    | Lack of in-flight mutex allows duplicate
      |                        | m     |                | simultaneous API fetches
   8  | popup.html:66,         | Mediu | DRY /          | popup.js loaded as classic script, copy-pasting
      | popup.js:1-32          | m     | Architecture   | functions from utils.js
   9  | popup.js:156,          | Mediu | Best Practice  | chrome.storage.local.get(null) loads entire
      | popup.js:168           | m     |                | storage dump instead of targeted keys
   10 | background.js:209-215  | Low   | Redundancy     | Redundant double call to updateBadge on refresh
      |                        |       |                | via explicit call + onChanged listener
   11 | background.js:9-13     | Low   | Consistency    | Inconsistent color palette (#2e7d32) versus
      |                        |       |                | utils.js and content.css (#10a37f)
   12 | utils.js:20-21         | Low   | DRY / Testing  | formatBadgeText missing from shared utils.js;
      |                        |       |                | duplicated in test files
   13 | chrome.storage.local:1-7 | Low   | Repository     | Stray abandoned TypeScript interface file
      |                        |       | Hygiene        | sitting in the project root
  ──────
  ## Actionable Fix Checklist

  ### 1. Minimized Widget Header Title Out of Sync

  • Location: content.js:96-104 and content.js:170-179
  • Severity: [High]
  • Issue Summary: The compact summary (e.g. 5: 85% | W: 60%) in #cgu-header-title is only set when
  content.js:114 runs. When a user clicks #cgu-minimize-btn or #cgu-toggle-header, content.js:96 only
  toggles the .cgu-minimized class on the container. The header text stays "Usage Limits". When restored,
  it doesn't revert back to "Usage Limits".
  • Exact Replacement:
  In content.js, maintain cachedPayload in module scope and extract a dedicated header updater:

      let widgetEl = null;
      let isMinimized = false;
      let cachedPayload = null;

      function updateHeaderTitle() {
        if (!widgetEl) return;
        const headerTitle = widgetEl.querySelector("#cgu-header-title");
        if (!headerTitle) return;

        if (!isMinimized || !cachedPayload?.rate_limit) {
          headerTitle.textContent = "Usage Limits";
          return;
        }

        const primary = cachedPayload.rate_limit.primary_window;
        const secondary = cachedPayload.rate_limit.secondary_window;
        const pText = primary && typeof primary.used_percent === "number"
          ? `${calculatePercentLeft(primary.used_percent)}%`
          : "--";
        const sText = secondary && typeof secondary.used_percent === "number"
          ? `${calculatePercentLeft(secondary.used_percent)}%`
          : "--";

        headerTitle.textContent = `5: ${pText} | W: ${sText}`;
      }

      function toggleMinimize() {
        isMinimized = !isMinimized;
        if (widgetEl) {
          widgetEl.classList.toggle("cgu-minimized", isMinimized);
        }
        updateHeaderTitle();
        chrome.storage.local.set({ floatingWidgetMinimized: isMinimized });
      }

  In content.js:114-179, store cachedPayload = payload; and call updateHeaderTitle(); instead of lines
  170–179.

  • Verification: In browser on https://chatgpt.com/, click minimize button and verify the header
  instantly changes from "Usage Limits" to 5: XX% | W: YY%, and reverts back when expanded.
  ──────
  ### 2. Service Worker Lifecycle Broken by setInterval & Storage Churn

  • Location: background.js:15-16, background.js:179-185, background.js:238-253
  • Severity: [High]
  • Issue Summary:
      1. Manifest V3 background service workers terminate after ~30s of inactivity. Periodic intervals
      (setInterval) stop executing when the worker sleeps, leaving the badge frozen.
      2. While the worker is active, the interval fires every 3.5 seconds and calls background.js:116,
      making an asynchronous IPC call to chrome.storage.local.get on every tick.
      3. Redundant lifecycle calls: background.js:179 is invoked on top-level evaluation, inside runtime.
      onInstalled, and inside runtime.onStartup.
  • Exact Replacement:
  Cache cachedPayload in memory. Let badge cycling render directly from memory rather than querying
  storage repeatedly. Synchronize cachedPayload on startup and via chrome.storage.onChanged:

    let badgeCycleTimer = null;
    let currentCycleIndex = 0;
    let cachedPayload = null;

    function renderBadge(payload) {
      if (!payload?.rate_limit) return;
      const primary = payload.rate_limit.primary_window;
      const secondary = payload.rate_limit.secondary_window;

      const primaryLeft =
        primary && typeof primary.used_percent === "number"
          ? calculatePercentLeft(primary.used_percent)
          : null;
      const secondaryLeft =
        secondary && typeof secondary.used_percent === "number"
          ? calculatePercentLeft(secondary.used_percent)
          : null;

      if (primaryLeft === null && secondaryLeft === null) return;

      const worst = getWorstStatus(
        primaryLeft !== null ? getStatusLevel(primaryLeft) : "green",
        secondaryLeft !== null ? getStatusLevel(secondaryLeft) : "green"
      );
      const color = STATUS_COLORS[worst.toUpperCase()] || STATUS_COLORS.GREEN;

      let text = "";
      if (primaryLeft !== null && secondaryLeft !== null) {
        text = currentCycleIndex === 0
          ? formatBadgeText("5", primaryLeft)
          : formatBadgeText("w", secondaryLeft);
      } else if (primaryLeft !== null) {
        text = formatBadgeText("5", primaryLeft);
      } else if (secondaryLeft !== null) {
        text = formatBadgeText("w", secondaryLeft);
      }

      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color });

      const titleParts = [];
      if (primaryLeft !== null) titleParts.push(`5h: ${primaryLeft}% left`);
      if (secondaryLeft !== null) titleParts.push(`Weekly: ${secondaryLeft}% left`);
      chrome.action.setTitle({
        title: `ChatGPT Usage Limits\n${titleParts.join("\n")}`,
      });
    }

    async function syncBadge() {
      if (!cachedPayload) {
        const data = await chrome.storage.local.get(["usagePayload"]);
        cachedPayload = data?.usagePayload || null;
      }
      renderBadge(cachedPayload);
    }

    function startBadgeCycleTimer() {
      if (badgeCycleTimer) clearInterval(badgeCycleTimer);
      badgeCycleTimer = setInterval(() => {
        currentCycleIndex = (currentCycleIndex + 1) % 2;
        if (cachedPayload) {
          renderBadge(cachedPayload);
        }
      }, 3500);
    }

  Remove calls to startBadgeCycleTimer() from inside onInstalled and onStartup, keeping the single
  synchronous initialization at root level.

  • Verification: Inspect the service worker in chrome://extensions/ under devtools. Monitor memory/CPU
  and observe badge alternate without invoking chrome.storage.local.get.
  ──────
  ### 3. refreshUsage Hides Errors and Fails Message Contract

  • Location: background.js:199-219 and background.js:256-261
  • Severity: [High]
  • Issue Summary:
  refreshUsage() swallows all errors and resolves with undefined. In chrome.runtime.onMessage:
  refreshUsage().then(() => sendResponse({ ok: true }));
  When authentication or network fails (e.g. 401/403 or server error), { ok: true } is still sent back.
  The popup receives { ok: true }, assumes the refresh succeeded, and does not notify the user.
  Furthermore, the updated payload is not returned in the response, forcing the caller to read storage
  again. If the popup closed in the meantime, unhandled exceptions occur.
  • Exact Replacement:

    async function refreshUsage() {
      try {
        const accessToken = await fetchAccessToken();
        const payload = await fetchUsageData(accessToken);

        const primary = payload?.rate_limit?.primary_window;
        if (!primary || typeof primary.used_percent !== "number") {
          throw new Error("unexpected-payload");
        }

        cachedPayload = payload;
        await chrome.storage.local.set({
          usagePayload: payload,
          lastUpdated: Date.now(),
        });

        renderBadge(cachedPayload);
        return { ok: true, payload };
      } catch (err) {
        console.warn("[chatgpt-usage] refresh failed:", err.message);
        setBadgeError();
        return { ok: false, error: err.message };
      }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === "refresh" || message?.action === "refresh_usage") {
        refreshUsage().then((result) => {
          try {
            sendResponse(result);
          } catch (_) {
            // Channel closed by sender before response arrived
          }
        });
        return true; // Keep message channel open for async response
      }
    });

  • Verification: Trigger a refresh with an expired session or while logged out. Verify the response
  contains { ok: false, error: ... } and badge displays "!".
  ──────
  ### 4. Popup Disconnect, Button Spamming & Stale Cache Display

  • Location: popup.js:136-165
  • Severity: [High]
  • Issue Summary:
      1. popup.js:137 is not disabled while refreshing. Clicking multiple times fires multiple background
      requests.
      2. The spinner class is cleared on a fixed 400ms timer (setTimeout(..., 400)), stopping even if the
      background fetch is still in flight.
      3. If refresh fails, popup.js falls back to chrome.storage.local.get(null) and re-renders old cached
      data from hours ago, deceiving the user into thinking the refresh succeeded.
  • Exact Replacement:

    function refreshUsage() {
      const refreshBtn = document.getElementById("refresh-btn");
      if (refreshBtn) {
        if (refreshBtn.disabled) return;
        refreshBtn.disabled = true;
        refreshBtn.classList.add("spinning");
      }

      const finalizeUI = () => {
        if (refreshBtn) {
          refreshBtn.classList.remove("spinning");
          refreshBtn.disabled = false;
        }
      };

      chrome.runtime.sendMessage({ action: "refresh_usage" }, (response) => {
        finalizeUI();

        if (chrome.runtime.lastError || !response || !response.ok) {
          showFallback("Log into ChatGPT or retry");
          return;
        }

        if (response.payload?.rate_limit) {
          render(response.payload.rate_limit);
          return;
        }

        loadCachedData();
      });
    }

  • Verification: Click refresh repeatedly; verify only one message is sent, button remains disabled with
  spinner running until completion, and errors display "Log into ChatGPT or retry" without rendering stale
  data.
  ──────
  ### 5. Enable ES Modules in manifest.json for Background Service Worker

  • Location: manifest.json:13-15
  • Severity: [Medium]
  • Issue Summary:
  Without "type": "module" under "background", Chrome treats background.js as a classic script. This
  prohibited importing utils.js, causing code duplication of calculatePercentLeft, getStatusLevel, and
  getWorstStatus.
  • Exact Replacement:
  In manifest.json:13-15:

       "background": {
    -    "service_worker": "background.js"
    +    "service_worker": "background.js",
    +    "type": "module"
       },

  In background.js:1-52:

    import {
      calculatePercentLeft,
      getStatusLevel,
      getWorstStatus,
      STATUS_COLORS,
      formatBadgeText
    } from "./utils.js";

  Delete the duplicate local implementations of those functions in background.js:26-52.

  • Verification: Run npm test and load unpacked extension in Chrome without script load errors.
  ──────
  ### 6. Detached DOM Reference in Content Script on SPA Navigations

  • Location: content.js:41-45 & content.js:114-116
  • Severity: [Medium]
  • Issue Summary:
  ChatGPT is a Next.js single-page application that can unmount or replace elements on navigation.
  content.js:38 holds a reference to the initial DOM node. If the page detaches it, content.js:114 checks
  if (!widgetEl), finds it truthy, and mutates a detached node. The user sees no widget. Additionally,
  document.body may not be ready if evaluated before body parse.
  • Exact Replacement:
  In content.js:

      function createWidget() {
        const existing = document.getElementById("chatgpt-usage-floating-widget");
        if (existing) {
          return existing;
        }

        const container = document.createElement("div");
        container.id = "chatgpt-usage-floating-widget";
        container.innerHTML = `...`; // Template HTML

        const targetParent = document.body || document.documentElement;
        targetParent.appendChild(container);

        const toggleBtn = container.querySelector("#cgu-minimize-btn");
        const toggleHeader = container.querySelector("#cgu-toggle-header");

        if (toggleBtn) toggleBtn.addEventListener("click", toggleMinimize);
        if (toggleHeader) toggleHeader.addEventListener("click", toggleMinimize);

        return container;
      }

      function getWidget() {
        if (!widgetEl || !document.contains(widgetEl)) {
          widgetEl = createWidget();
        }
        return widgetEl;
      }

  Replace all occurrences of widgetEl = createWidget() with widgetEl = getWidget().

  • Verification: Simulate client-side navigation or remove the widget in Chrome Elements panel; verify
  that on next storage event the widget automatically reattaches to the live DOM.
  ──────
  ### 7. Concurrent Refresh Race Condition Mutex

  • Location: background.js:199-219
  • Severity: [Medium]
  • Issue Summary:
  If the periodic alarm triggers at the same time the user opens the popup or clicks refresh, multiple
  simultaneous fetch() operations run in parallel, creating race conditions on chrome.storage.local.set.
  • Exact Replacement:
  Add an in-flight promise guard to background.js:

    let refreshInFlight = null;

    async function refreshUsage() {
      if (refreshInFlight) {
        return refreshInFlight;
      }

      refreshInFlight = (async () => {
        try {
          const accessToken = await fetchAccessToken();
          const payload = await fetchUsageData(accessToken);

          const primary = payload?.rate_limit?.primary_window;
          if (!primary || typeof primary.used_percent !== "number") {
            throw new Error("unexpected-payload");
          }

          cachedPayload = payload;
          await chrome.storage.local.set({
            usagePayload: payload,
            lastUpdated: Date.now(),
          });

          renderBadge(cachedPayload);
          return { ok: true, payload };
        } catch (err) {
          console.warn("[chatgpt-usage] refresh failed:", err.message);
          setBadgeError();
          return { ok: false, error: err.message };
        } finally {
          refreshInFlight = null;
        }
      })();

      return refreshInFlight;
    }

  • Verification: Invoke refreshUsage() back-to-back in parallel; check Network tab to confirm only a
  single /api/auth/session and /usage request is dispatched.
  ──────
  ### 8. Use ES Modules in popup.html and Import from utils.js

  • Location: popup.html:66 & popup.js:1-32
  • Severity: [Medium]
  • Issue Summary:
  popup.js duplicated calculatePercentLeft, formatResetTime, getStatusLevel, and getWorstStatus because it
  was loaded via <script src="popup.js"> without module support.
  • Exact Replacement:
  In popup.html:66:

    -  <script src="popup.js"></script>
    +  <script type="module" src="popup.js"></script>

  In popup.js:1-32:

    import {
      calculatePercentLeft,
      formatResetTime,
      getStatusLevel,
      getWorstStatus
    } from "./utils.js";

  Remove the duplicate function definitions from lines 1–32 of popup.js.

  • Verification: Run npm test (specifically dom_contract.test.js) and open the popup in browser to
  confirm calculations render as expected.
  ──────
  ### 9. Eliminate Storage Anti-Pattern get(null)

  • Location: popup.js:156 & popup.js:168
  • Severity: [Medium]
  • Issue Summary:
  Calling chrome.storage.local.get(null) dumps all stored items across the extension into memory,
  violating the principle of least privilege and increasing serialization overhead.
  • Exact Replacement:
  In popup.js:

    const STORAGE_KEYS = ["usagePayload", "floatingWidgetEnabled"];

    function loadCachedData(callback) {
      chrome.storage.local.get(STORAGE_KEYS, (result) => {
        if (chrome.runtime.lastError || !result) {
          if (callback) callback(false);
          return;
        }

        const toggleFloating = document.getElementById("toggle-floating");
        if (toggleFloating) {
          toggleFloating.checked = result.floatingWidgetEnabled !== false;
        }

        const rateLimit = getRateLimitData(result);
        if (rateLimit && (rateLimit.primary_window || rateLimit.secondary_window)) {
          render(rateLimit);
          if (callback) callback(true);
        } else {
          if (callback) callback(false);
        }
      });
    }

  • Verification: Ensure popup loads and restores the toggle state and cached rate limits without
  requesting unnecessary keys.
  ──────
  ### 10. Redundant Badge Updates on Refresh

  • Location: background.js:209-215 and background.js:263-267
  • Severity: [Low]
  • Issue Summary:
  refreshUsage() calls chrome.storage.local.set(), which triggers the chrome.storage.onChanged listener
  calling updateBadgeFromStorage(). Immediately after await chrome.storage.local.set(), refreshUsage()
  called await updateBadgeFromStorage() a second time.
  • Exact Replacement:
  Delegate badge rendering purely to renderBadge(cachedPayload) or the onChanged listener; do not trigger
  duplicate badge updates in both places.
  • Verification: Add a console debug log in renderBadge() and confirm it fires only once per refresh
  cycle.
  ──────
  ### 11. Normalize Color Palette Constants

  • Location: background.js:9-13 vs utils.js:42-46
  • Severity: [Low]
  • Issue Summary:
  background.js defines green as #2e7d32, whereas utils.js, popup.css, and content.css use OpenAI brand
  green #10a37f.
  • Exact Replacement:
  Remove const STATUS_COLORS from background.js and import STATUS_COLORS directly from utils.js.
  • Verification: Badge color matches the popup brand color when status is green.
  ──────
  ### 12. Export formatBadgeText from utils.js

  • Location: utils.js:20-21 & payload_parsing.test.js:50-64
  • Severity: [Low]
  • Issue Summary:
  formatBadgeText is declared locally in background.js and re-declared inside
  payload_parsing.test.js:51-54 rather than being a tested unit export in utils.js.
  • Exact Replacement:
  In utils.js:

    /**
     * Formats badge text to strictly stay within 4 characters.
     *
     * @param {string} prefix
     * @param {number} percent
     * @returns {string}
     */
    export function formatBadgeText(prefix, percent) {
      const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      if (p >= 100) return `${prefix}100`;
      return `${prefix}:${p}`;
    }

  Import it in background.js and payload_parsing.test.js.

  • Verification: npm test passes all badge formatting assertions.
  ──────
  ### 13. Remove Stray Root File chrome.storage.local

  • Location: chrome.storage.local:1-7
  • Severity: [Low]
  • Issue Summary:
  The project root contains an orphan file named chrome.storage.local containing a TypeScript interface
  fragment. This file is unused and will be packaged into the extension distribution zip if not cleaned.
  • Exact Replacement:
  Delete the file chrome.storage.local from the repository root (or merge its interface into
  data_schema.js JSDoc types).
  • Verification: Verify git status shows the file removed and npm test remains green.
  ──────
  ### Verification Suite Commands

  After applying the fixes, run:

    npm run check:syntax
    npm test
