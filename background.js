import {
  calculatePercentLeft,
  getStatusLevel,
  getWorstStatus,
  STATUS_COLORS,
  formatBadgeText,
} from "./utils.js";

/* ─── constants ────────────────────────────────────────────────── */

const ALARM_NAME = "refresh-usage";
const ALARM_PERIOD_MINUTES = 5;

const SESSION_URL = "https://chatgpt.com/api/auth/session";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

let badgeCycleTimer = null;
let currentCycleIndex = 0; // 0 for 5h, 1 for weekly
let cachedPayload = null;
let refreshInFlight = null;
let badgeTextEnabled = true;

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
 * Renders the badge and action title based on the given usage payload.
 *
 * @param {object|null} payload
 */
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

  const titleParts = [];
  if (primaryLeft !== null) titleParts.push(`5h: ${primaryLeft}% left`);
  if (secondaryLeft !== null) titleParts.push(`Weekly: ${secondaryLeft}% left`);
  chrome.action.setTitle({
    title: `ChatGPT Usage Limits\n${titleParts.join("\n")}`,
  });

  if (!badgeTextEnabled) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  let text = "";
  if (primaryLeft !== null && secondaryLeft !== null) {
    text =
      currentCycleIndex === 0
        ? formatBadgeText(primaryLeft)
        : formatBadgeText(secondaryLeft);
  } else if (primaryLeft !== null) {
    text = formatBadgeText(primaryLeft);
  } else if (secondaryLeft !== null) {
    text = formatBadgeText(secondaryLeft);
  }

  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }
}

/**
 * Synchronizes cached payload from storage and renders badge.
 */
async function syncBadge() {
  const data = await chrome.storage.local.get(["usagePayload", "badgeTextEnabled"]);
  if (data?.usagePayload) {
    cachedPayload = data.usagePayload;
  }
  badgeTextEnabled = data?.badgeTextEnabled !== false;
  if (!badgeTextEnabled) {
    stopBadgeCycleTimer();
    chrome.action.setBadgeText({ text: "" });
  } else {
    renderBadge(cachedPayload);
    startBadgeCycleTimer();
  }
}

/**
 * Stops badge cycling timer if active.
 */
function stopBadgeCycleTimer() {
  if (badgeCycleTimer) {
    clearInterval(badgeCycleTimer);
    badgeCycleTimer = null;
  }
}

/**
 * Starts badge cycling timer using in-memory cached payload.
 */
function startBadgeCycleTimer() {
  stopBadgeCycleTimer();
  if (!badgeTextEnabled) return;
  badgeCycleTimer = setInterval(() => {
    currentCycleIndex = (currentCycleIndex + 1) % 2;
    if (cachedPayload && badgeTextEnabled) {
      renderBadge(cachedPayload);
    }
  }, 3500);
}

/**
 * Clears or marks the badge to indicate an error state.
 */
function setBadgeError() {
  if (badgeTextEnabled) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: STATUS_COLORS.RED });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: "#ffffff" });
    }
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
  chrome.action.setTitle({ title: "ChatGPT Usage: Log in or refresh failed" });
}

/**
 * Main refresh routine: authenticate -> fetch usage -> persist -> update badge.
 * Includes in-flight mutex to avoid duplicate concurrent calls.
 *
 * @returns {Promise<{ ok: boolean, payload?: object, error?: string }>}
 */
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

// Run cycle timer on worker awake
startBadgeCycleTimer();
syncBadge();

/* ─── storage change listener ──────────────────────────────────── */

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.badgeTextEnabled) {
      badgeTextEnabled = changes.badgeTextEnabled.newValue !== false;
      if (!badgeTextEnabled) {
        stopBadgeCycleTimer();
        chrome.action.setBadgeText({ text: "" });
      } else {
        renderBadge(cachedPayload);
        startBadgeCycleTimer();
      }
    }
    if (changes.usagePayload) {
      cachedPayload = changes.usagePayload.newValue || null;
      if (badgeTextEnabled) {
        renderBadge(cachedPayload);
      }
    }
  }
});

/* ─── message handling ─────────────────────────────────────────── */

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
