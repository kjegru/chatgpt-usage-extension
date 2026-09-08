/* ─── constants ────────────────────────────────────────────────── */

const ALARM_NAME = "refresh-usage";
const ALARM_PERIOD_MINUTES = 5;

const SESSION_URL = "https://chatgpt.com/api/auth/session";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

const BADGE_COLOR_OK = "#2e7d32"; // green-ish
const BADGE_COLOR_WARN = "#e65100"; // orange-red

const REMAINING_WARN_THRESHOLD = 15;

/* ─── helpers ──────────────────────────────────────────────────── */

/**
 * Returns remaining percentage rounded to a whole number (100 − usedPercent).
 * Mirrors calculatePercentLeft in utils.js but avoids ES-module import.
 *
 * @param {number} usedPercent
 * @returns {number}
 */
function calculatePercentLeft(usedPercent) {
  const used =
    typeof usedPercent === "number" ? usedPercent : Number(usedPercent);
  if (Number.isNaN(used)) return 0;
  return Math.round(100 - used);
}

/* ─── core logic ───────────────────────────────────────────────── */

/**
 * Fetches the accessToken from the ChatGPT session endpoint.
 *
 * @returns {Promise<string>} accessToken
 * @throws {Error} on non-OK responses or missing token
 */
async function fetchAccessToken() {
  const res = await fetch(SESSION_URL, { credentials: "include" });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`auth/${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`session-http-${res.status}`);
  }

  const data = await res.json();
  const token = data?.accessToken;
  if (!token) {
    throw new Error("no-access-token");
  }
  return token;
}

/**
 * Fetches the usage payload using the provided bearer token.
 *
 * @param {string} accessToken
 * @returns {Promise<object>} parsed UsageData payload
 * @throws {Error} on non-OK responses
 */
async function fetchUsageData(accessToken) {
  const res = await fetch(USAGE_URL, {
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`usage-auth/${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`usage-http-${res.status}`);
  }

  return res.json();
}

/**
 * Updates the toolbar badge to reflect the remaining percentage.
 *
 * @param {number} remaining  0–100
 */
function updateBadge(remaining) {
  const text = `${remaining}%`;
  const color =
    remaining < REMAINING_WARN_THRESHOLD ? BADGE_COLOR_WARN : BADGE_COLOR_OK;

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Clears or marks the badge to indicate an error state.
 */
function setBadgeError() {
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_WARN });
}

/**
 * Main refresh routine: authenticate → fetch usage → persist → update badge.
 * All network / parse errors are caught so the service worker never throws
 * an unhandled rejection.
 */
async function refreshUsage() {
  try {
    const accessToken = await fetchAccessToken();
    const payload = await fetchUsageData(accessToken);

    const primary = payload?.rate_limit?.primary_window;
    if (!primary || typeof primary.used_percent !== "number") {
      throw new Error("unexpected-payload");
    }

    await chrome.storage.local.set({
      usagePayload: payload,
      lastUpdated: Date.now(),
    });

    const remaining = calculatePercentLeft(primary.used_percent);
    updateBadge(remaining);
  } catch (err) {
    console.warn("[chatgpt-usage] refresh failed:", err.message);
    setBadgeError();
  }
}

/* ─── alarms ───────────────────────────────────────────────────── */

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    refreshUsage();
  }
});

/* ─── lifecycle events ─────────────────────────────────────────── */

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  refreshUsage();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  refreshUsage();
});

/* ─── message handling (popup → background) ────────────────────── */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "refresh" || message?.action === "refresh_usage") {
    refreshUsage().then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for async sendResponse
  }
});
