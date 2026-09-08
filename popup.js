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

function showFallback(message = "Log into ChatGPT") {
  const limitList = document.querySelector(".limit-list");
  if (limitList) {
    limitList.style.display = "none";
  }

  let fallbackEl = document.getElementById("fallback-message");
  if (!fallbackEl) {
    fallbackEl = document.createElement("div");
    fallbackEl.id = "fallback-message";
    fallbackEl.style.textAlign = "center";
    fallbackEl.style.padding = "20px 0";
    fallbackEl.style.color = "var(--text-secondary)";
    fallbackEl.style.fontSize = "13px";
    fallbackEl.style.fontWeight = "500";
    const card = document.querySelector(".card");
    if (card) {
      card.appendChild(fallbackEl);
    } else {
      document.body.appendChild(fallbackEl);
    }
  }
  fallbackEl.textContent = message;
  fallbackEl.style.display = "block";
}

function showContent() {
  const limitList = document.querySelector(".limit-list");
  if (limitList) {
    limitList.style.display = "";
  }
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

  if (primary && primary.used_percent !== undefined) {
    const percentLeft = calculatePercentLeft(primary.used_percent);
    const percent5h = document.getElementById("percent-5h");
    const progress5h = document.getElementById("progress-5h");
    const reset5h = document.getElementById("reset-5h");

    if (percent5h) percent5h.textContent = `${percentLeft}% left`;
    if (progress5h) progress5h.style.width = `${percentLeft}%`;
    if (reset5h) reset5h.textContent = `Resets in ${formatResetTime(primary.reset_after_seconds)}`;
  }

  if (secondary && secondary.used_percent !== undefined) {
    const percentLeft = calculatePercentLeft(secondary.used_percent);
    const percentWeekly = document.getElementById("percent-weekly");
    const progressWeekly = document.getElementById("progress-weekly");
    const resetWeekly = document.getElementById("reset-weekly");

    if (percentWeekly) percentWeekly.textContent = `${percentLeft}% left`;
    if (progressWeekly) progressWeekly.style.width = `${percentLeft}%`;
    if (resetWeekly) resetWeekly.textContent = `Resets in ${formatResetTime(secondary.reset_after_seconds)}`;
  }
}

function refreshUsage() {
  chrome.runtime.sendMessage({ action: "refresh_usage" }, (response) => {
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

  const refreshBtn = document.getElementById("refresh-btn") ||
                     document.getElementById("refresh") ||
                     document.querySelector(".refresh-btn") ||
                     document.querySelector("button");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => refreshUsage());
  }

  document.addEventListener("click", (event) => {
    if (event.target && event.target.closest && event.target.closest("#refresh-btn, #refresh, .refresh-btn, button.refresh")) {
      refreshUsage();
    }
  });

  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        loadCachedData();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
