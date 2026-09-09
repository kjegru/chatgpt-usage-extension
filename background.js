/* ─── constants ────────────────────────────────────────────────── */

const ALARM_NAME = "refresh-usage";
const ALARM_PERIOD_MINUTES = 5;

const SESSION_URL = "https://chatgpt.com/api/auth/session";
const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

const STATUS_COLORS = {
  green: "#2e7d32",
  yellow: "#d97706",
  red: "#dc2626",
};

let badgeCycleTimer = null;
let currentCycleIndex = 0; // 0 for 5h, 1 for weekly

/* ─── helpers ──────────────────────────────────────────────────── */

/**
 * Returns remaining percentage rounded to a whole number (100 − usedPercent).
 *
 * @param {number} usedPercent
 * @returns {number}
 */
function calculatePercentLeft(usedPercent) {
  const used =
    typeof usedPercent === "number" ? usedPercent : Number(usedPercent);
  if (Number.isNaN(used)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

/**
 * Returns status level ('green' | 'yellow' | 'red') for a remaining percentage.
 *
 * @param {number} percentLeft
 * @returns {'green' | 'yellow' | 'red'}
 */
function getStatusLevel(percentLeft) {
  if (percentLeft < 15) return "red";
  if (percentLeft <= 30) return "yellow";
  return "green";
}

/**
 * Returns worst status between two levels.
 */
function getWorstStatus(s1, s2) {
  if (s1 === "red" || s2 === "red") return "red";
  if (s1 === "yellow" || s2 === "yellow") return "yellow";
  return "green";
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
 * Formats badge text for a given prefix and percent.
 * Maximum badge text length is typically 4 characters.
 * e.g., '5:87' or 'w:65'. If 100%, '5:99' or '5:100' -> '5:99' / '5MAX' / '5100'
 */
function formatBadgeText(prefix, percent) {
  if (percent >= 100) return `${prefix}100`;
  return `${prefix}:${percent}`;
}

/**
 * Updates badge display based on stored usage payload.
 */
async function updateBadgeFromStorage() {
  try {
    const data = await chrome.storage.local.get(["usagePayload"]);
    const payload = data?.usagePayload;
    if (!payload?.rate_limit) {
      return;
    }

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

    if (primaryLeft === null && secondaryLeft === null) {
      return;
    }

    // Determine status color based on worst-case
    const statusPrimary = primaryLeft !== null ? getStatusLevel(primaryLeft) : "green";
    const statusSecondary = secondaryLeft !== null ? getStatusLevel(secondaryLeft) : "green";
    const worst = getWorstStatus(statusPrimary, statusSecondary);
    const color = STATUS_COLORS[worst] || STATUS_COLORS.green;

    // Determine which limit to show on current cycle
    let text = "";
    if (primaryLeft !== null && secondaryLeft !== null) {
      if (currentCycleIndex === 0) {
        text = formatBadgeText("5", primaryLeft);
      } else {
        text = formatBadgeText("w", secondaryLeft);
      }
    } else if (primaryLeft !== null) {
      text = formatBadgeText("5", primaryLeft);
    } else if (secondaryLeft !== null) {
      text = formatBadgeText("w", secondaryLeft);
    }

    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });

    // Set tooltip / action title for quick hover view
    const titleParts = [];
    if (primaryLeft !== null) titleParts.push(`5h: ${primaryLeft}% left`);
    if (secondaryLeft !== null) titleParts.push(`Weekly: ${secondaryLeft}% left`);
    chrome.action.setTitle({
      title: `ChatGPT Usage Limits\n${titleParts.join("\n")}`,
    });
  } catch (e) {
    console.warn("[chatgpt-usage] updateBadge error:", e);
  }
}

/**
 * Starts badge cycling timer.
 */
function startBadgeCycleTimer() {
  if (badgeCycleTimer) clearInterval(badgeCycleTimer);
  badgeCycleTimer = setInterval(() => {
    currentCycleIndex = (currentCycleIndex + 1) % 2;
    updateBadgeFromStorage();
  }, 3500);
}

/**
 * Clears or marks the badge to indicate an error state.
 */
function setBadgeError() {
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: STATUS_COLORS.red });
  chrome.action.setTitle({ title: "ChatGPT Usage: Log in or refresh failed" });
}

/**
 * Main refresh routine: authenticate → fetch usage → persist → update badge.
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

    await updateBadgeFromStorage();
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
  startBadgeCycleTimer();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  refreshUsage();
  startBadgeCycleTimer();
});

// Run cycle timer on worker awake
startBadgeCycleTimer();
updateBadgeFromStorage();

/* ─── message handling ─────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "refresh" || message?.action === "refresh_usage") {
    refreshUsage().then(() => sendResponse({ ok: true }));
    return true; // keep message channel open for async response
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.usagePayload) {
    updateBadgeFromStorage();
  }
});
