(() => {
  if (window.__chatgptUsageWidgetInjected) return;
  window.__chatgptUsageWidgetInjected = true;

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

  function createWidget() {
    const existing = document.getElementById("chatgpt-usage-floating-widget");
    if (existing) {
      return existing;
    }

    const container = document.createElement("div");
    container.id = "chatgpt-usage-floating-widget";

    container.innerHTML = `
      <div class="cgu-card">
        <div class="cgu-header">
          <div class="cgu-title-group" id="cgu-toggle-header">
            <span class="cgu-status-dot cgu-green" id="cgu-status-dot"></span>
            <span class="cgu-title" id="cgu-header-title">Usage Limits</span>
          </div>
          <div class="cgu-controls">
            <button class="cgu-icon-btn" id="cgu-minimize-btn" title="Minimize / Expand">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <div class="cgu-body" id="cgu-body">
          <div class="cgu-row">
            <div class="cgu-row-meta">
              <span class="cgu-row-label">5-hour</span>
              <span class="cgu-row-val" id="cgu-val-5h">--% left</span>
            </div>
            <div class="cgu-progress-track">
              <div class="cgu-progress-fill cgu-green" id="cgu-bar-5h" style="width: 0%;"></div>
            </div>
            <span class="cgu-reset-text" id="cgu-reset-5h">--</span>
          </div>

          <div class="cgu-row">
            <div class="cgu-row-meta">
              <span class="cgu-row-label">Weekly</span>
              <span class="cgu-row-val" id="cgu-val-weekly">--% left</span>
            </div>
            <div class="cgu-progress-track">
              <div class="cgu-progress-fill cgu-green" id="cgu-bar-weekly" style="width: 0%;"></div>
            </div>
            <span class="cgu-reset-text" id="cgu-reset-weekly">--</span>
          </div>
        </div>
      </div>
    `;

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

  function setElementStatusClass(el, status) {
    if (!el) return;
    el.classList.remove("cgu-green", "cgu-yellow", "cgu-red");
    el.classList.add(`cgu-${status}`);
  }

  function renderUsage(payload) {
    cachedPayload = payload;
    widgetEl = getWidget();

    const rateLimit = payload?.rate_limit;
    if (!rateLimit) return;

    const primary = rateLimit.primary_window;
    const secondary = rateLimit.secondary_window;

    let primaryStatus = "green";
    let secondaryStatus = "green";

    let primaryLeftText = "--";
    let secondaryLeftText = "--";

    if (primary && typeof primary.used_percent === "number") {
      const pLeft = calculatePercentLeft(primary.used_percent);
      primaryStatus = getStatusLevel(pLeft);
      primaryLeftText = `${pLeft}%`;

      const val5h = widgetEl.querySelector("#cgu-val-5h");
      const bar5h = widgetEl.querySelector("#cgu-bar-5h");
      const reset5h = widgetEl.querySelector("#cgu-reset-5h");

      if (val5h) val5h.textContent = `${pLeft}% left`;
      if (bar5h) {
        bar5h.style.width = `${pLeft}%`;
        setElementStatusClass(bar5h, primaryStatus);
      }
      if (reset5h) reset5h.textContent = `Resets in ${formatResetTime(primary.reset_after_seconds)}`;
    }

    if (secondary && typeof secondary.used_percent === "number") {
      const sLeft = calculatePercentLeft(secondary.used_percent);
      secondaryStatus = getStatusLevel(sLeft);
      secondaryLeftText = `${sLeft}%`;

      const valWeekly = widgetEl.querySelector("#cgu-val-weekly");
      const barWeekly = widgetEl.querySelector("#cgu-bar-weekly");
      const resetWeekly = widgetEl.querySelector("#cgu-reset-weekly");

      if (valWeekly) valWeekly.textContent = `${sLeft}% left`;
      if (barWeekly) {
        barWeekly.style.width = `${sLeft}%`;
        setElementStatusClass(barWeekly, secondaryStatus);
      }
      if (resetWeekly) resetWeekly.textContent = `Resets in ${formatResetTime(secondary.reset_after_seconds)}`;
    }

    // Overall status dot
    const worst = getWorstStatus(primaryStatus, secondaryStatus);
    const dot = widgetEl.querySelector("#cgu-status-dot");
    if (dot) {
      setElementStatusClass(dot, worst);
    }

    updateHeaderTitle();
  }

  function updateWidgetVisibility(enabled) {
    widgetEl = getWidget();
    widgetEl.style.display = enabled ? "block" : "none";
  }

  function init() {
    chrome.storage.local.get(
      ["usagePayload", "floatingWidgetEnabled", "floatingWidgetMinimized"],
      (res) => {
        if (chrome.runtime.lastError) return;

        widgetEl = getWidget();

        if (res.floatingWidgetMinimized) {
          isMinimized = true;
          widgetEl.classList.add("cgu-minimized");
        }

        const enabled = res.floatingWidgetEnabled !== false;
        updateWidgetVisibility(enabled);

        if (res.usagePayload) {
          renderUsage(res.usagePayload);
        } else {
          updateHeaderTitle();
        }
      }
    );

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        if (changes.usagePayload) {
          renderUsage(changes.usagePayload.newValue);
        }
        if (changes.floatingWidgetEnabled !== undefined) {
          updateWidgetVisibility(changes.floatingWidgetEnabled.newValue !== false);
        }
        if (changes.floatingWidgetMinimized !== undefined) {
          isMinimized = !!changes.floatingWidgetMinimized.newValue;
          if (widgetEl) {
            widgetEl.classList.toggle("cgu-minimized", isMinimized);
          }
          updateHeaderTitle();
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
