function calculatePercentLeft(usedPercent) {
  const used = typeof usedPercent === "number" ? usedPercent : Number(usedPercent);
  if (Number.isNaN(used)) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

function formatResetTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function getStatusLevel(percentLeft) {
  if (percentLeft < 15) return "red";
  if (percentLeft <= 30) return "yellow";
  return "green";
}

function getWorstStatus(s1, s2) {
  if (s1 === "red" || s2 === "red") return "red";
  if (s1 === "yellow" || s2 === "yellow") return "yellow";
  return "green";
}

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
  if (refreshBtn) refreshBtn.classList.add("spinning");

  chrome.runtime.sendMessage({ action: "refresh_usage" }, (response) => {
    setTimeout(() => {
      if (refreshBtn) refreshBtn.classList.remove("spinning");
    }, 400);

    if (chrome.runtime.lastError) {
      showFallback("Log into ChatGPT");
      return;
    }

    if (response && (response.rate_limit || response.data?.rate_limit)) {
      const rateLimit = response.rate_limit || response.data.rate_limit;
      render(rateLimit);
      return;
    }

    chrome.storage.local.get(null, (items) => {
      const rateLimit = getRateLimitData(items);
      if (rateLimit && (rateLimit.primary_window || rateLimit.secondary_window)) {
        render(rateLimit);
      } else {
        showFallback("Log into ChatGPT");
      }
    });
  });
}

function loadCachedData(callback) {
  chrome.storage.local.get(null, (result) => {
    if (chrome.runtime.lastError || !result) {
      if (callback) callback(false);
      return;
    }

    // Restore floating widget toggle setting (default: true)
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

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.usagePayload) {
          loadCachedData();
        }
        if (changes.floatingWidgetEnabled && toggleFloating) {
          toggleFloating.checked = changes.floatingWidgetEnabled.newValue !== false;
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
