import {
  calculatePercentLeft,
  formatResetTime,
  getStatusLevel,
  getWorstStatus
} from "./utils.js";

function setElementStatusClass(el, status) {
  if (!el) return;
  el.classList.remove("status-green", "status-yellow", "status-red");
  el.classList.add(`status-${status}`);
}

function showFallback(message = "Log into ChatGPT") {
  const limitRows = document.querySelectorAll(".limit-row");
  limitRows.forEach((row) => (row.style.display = "none"));

  let fallbackEl = document.getElementById("fallback-message");
  if (!fallbackEl) {
    fallbackEl = document.createElement("div");
    fallbackEl.id = "fallback-message";
    fallbackEl.style.textAlign = "center";
    fallbackEl.style.padding = "20px 0";
    fallbackEl.style.color = "var(--text-secondary)";
    fallbackEl.style.fontSize = "13px";
    fallbackEl.style.fontWeight = "500";
    const list = document.querySelector(".limit-list");
    if (list) {
      list.insertBefore(fallbackEl, list.firstChild);
    }
  }
  fallbackEl.textContent = message;
  fallbackEl.style.display = "block";
}

function showContent() {
  const limitRows = document.querySelectorAll(".limit-row");
  limitRows.forEach((row) => (row.style.display = "flex"));
  const fallbackEl = document.getElementById("fallback-message");
  if (fallbackEl) {
    fallbackEl.style.display = "none";
  }
}

function getRateLimitData(data) {
  if (!data) return null;
  const payload = data.usagePayload || data.usageData || data;
  return payload.rate_limit || data.rate_limit || null;
}

function render(rateLimit) {
  if (!rateLimit || (!rateLimit.primary_window && !rateLimit.secondary_window)) {
    showFallback("Log into ChatGPT");
    return;
  }

  showContent();

  const primary = rateLimit.primary_window;
  const secondary = rateLimit.secondary_window;

  let primaryStatus = "green";
  let secondaryStatus = "green";

  if (primary && primary.used_percent !== undefined) {
    const percentLeft = calculatePercentLeft(primary.used_percent);
    primaryStatus = getStatusLevel(percentLeft);

    const percent5h = document.getElementById("percent-5h");
    const progress5h = document.getElementById("progress-5h");
    const reset5h = document.getElementById("reset-5h");

    if (percent5h) percent5h.textContent = `${percentLeft}% left`;
    if (progress5h) {
      progress5h.style.width = `${percentLeft}%`;
      setElementStatusClass(progress5h, primaryStatus);
    }
    if (reset5h) reset5h.textContent = `Resets in ${formatResetTime(primary.reset_after_seconds)}`;
  }

  if (secondary && secondary.used_percent !== undefined) {
    const percentLeft = calculatePercentLeft(secondary.used_percent);
    secondaryStatus = getStatusLevel(percentLeft);

    const percentWeekly = document.getElementById("percent-weekly");
    const progressWeekly = document.getElementById("progress-weekly");
    const resetWeekly = document.getElementById("reset-weekly");

    if (percentWeekly) percentWeekly.textContent = `${percentLeft}% left`;
    if (progressWeekly) {
      progressWeekly.style.width = `${percentLeft}%`;
      setElementStatusClass(progressWeekly, secondaryStatus);
    }
    if (resetWeekly) resetWeekly.textContent = `Resets in ${formatResetTime(secondary.reset_after_seconds)}`;
  }

  // Header icon color reflects the worst status of either window
  const worst = getWorstStatus(primaryStatus, secondaryStatus);
  const brandIcon = document.getElementById("header-brand-icon");
  if (brandIcon) {
    const colorMap = {
      green: "var(--color-green)",
      yellow: "var(--color-yellow)",
      red: "var(--color-red)",
    };
    brandIcon.style.color = colorMap[worst] || colorMap.green;
  }
}

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

const STORAGE_KEYS = ["usagePayload", "floatingWidgetEnabled", "badgeTextEnabled"];

function loadCachedData(callback) {
  chrome.storage.local.get(STORAGE_KEYS, (result) => {
    if (chrome.runtime.lastError || !result) {
      if (callback) callback(false);
      return;
    }

    // Restore floating widget toggle setting (default: true)
    const toggleFloating = document.getElementById("toggle-floating");
    if (toggleFloating) {
      toggleFloating.checked = result.floatingWidgetEnabled !== false;
    }

    // Restore badge text toggle setting (default: true)
    const toggleBadge = document.getElementById("toggle-badge");
    if (toggleBadge) {
      toggleBadge.checked = result.badgeTextEnabled !== false;
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

function init() {
  loadCachedData((hasData) => {
    if (!hasData) {
      refreshUsage();
    }
  });

  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => refreshUsage());
  }

  const toggleFloating = document.getElementById("toggle-floating");
  if (toggleFloating) {
    toggleFloating.addEventListener("change", (e) => {
      chrome.storage.local.set({ floatingWidgetEnabled: e.target.checked });
    });
  }

  const toggleBadge = document.getElementById("toggle-badge");
  if (toggleBadge) {
    toggleBadge.addEventListener("change", (e) => {
      chrome.storage.local.set({ badgeTextEnabled: e.target.checked });
    });
  }

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.usagePayload) {
          loadCachedData();
        }
        if (changes.floatingWidgetEnabled && toggleFloating) {
          toggleFloating.checked = changes.floatingWidgetEnabled.newValue !== false;
        }
        if (changes.badgeTextEnabled && toggleBadge) {
          toggleBadge.checked = changes.badgeTextEnabled.newValue !== false;
        }
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
