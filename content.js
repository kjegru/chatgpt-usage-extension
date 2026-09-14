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

  /**
   * Builds the floating widget using only safe DOM APIs (createElement, textContent, createElementNS).
   * All element text is set via .textContent; SVG via createElementNS.
   */
  function createWidget() {
    const existing = document.getElementById("chatgpt-usage-floating-widget");
    if (existing) {
      return existing;
    }

    const container = document.createElement("div");
    container.id = "chatgpt-usage-floating-widget";

    // ── Card ──────────────────────────────────────────────────────
    const card = document.createElement("div");
    card.className = "cgu-card";

    // ── Header ────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "cgu-header";

    // Title group (status dot + title text)
    const titleGroup = document.createElement("div");
    titleGroup.className = "cgu-title-group";
    titleGroup.id = "cgu-toggle-header";

    const statusDot = document.createElement("span");
    statusDot.className = "cgu-status-dot cgu-green";
    statusDot.id = "cgu-status-dot";

    const headerTitle = document.createElement("span");
    headerTitle.className = "cgu-title";
    headerTitle.id = "cgu-header-title";
    headerTitle.textContent = "Usage Limits";

    titleGroup.appendChild(statusDot);
    titleGroup.appendChild(headerTitle);

    // Controls (minimize button with SVG icon)
    const controls = document.createElement("div");
    controls.className = "cgu-controls";

    const minimizeBtn = document.createElement("button");
    minimizeBtn.className = "cgu-icon-btn";
    minimizeBtn.id = "cgu-minimize-btn";
    minimizeBtn.title = "Minimize / Expand";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "12");
    svg.setAttribute("height", "12");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    const poly1 = document.createElementNS(svgNS, "polyline");
    poly1.setAttribute("points", "4 14 10 14 10 20");
    const poly2 = document.createElementNS(svgNS, "polyline");
    poly2.setAttribute("points", "20 10 14 10 14 4");
    svg.appendChild(poly1);
    svg.appendChild(poly2);

    minimizeBtn.appendChild(svg);
    controls.appendChild(minimizeBtn);

    header.appendChild(titleGroup);
    header.appendChild(controls);

    // ── Body ──────────────────────────────────────────────────────
    const body = document.createElement("div");
    body.className = "cgu-body";
    body.id = "cgu-body";

    /**
     * Builds a metric row (label, percentage value, progress bar, reset text).
     * @param {string} labelText
     * @param {string} valId
     * @param {string} barId
     * @param {string} resetId
     */
    function makeRow(labelText, valId, barId, resetId) {
      const row = document.createElement("div");
      row.className = "cgu-row";

      const rowMeta = document.createElement("div");
      rowMeta.className = "cgu-row-meta";

      const label = document.createElement("span");
      label.className = "cgu-row-label";
      label.textContent = labelText;

      const val = document.createElement("span");
      val.className = "cgu-row-val";
      val.id = valId;
      val.textContent = "--% left";

      rowMeta.appendChild(label);
      rowMeta.appendChild(val);

      const track = document.createElement("div");
      track.className = "cgu-progress-track";

      const fill = document.createElement("div");
      fill.className = "cgu-progress-fill cgu-green";
      fill.id = barId;
      fill.style.width = "0%";
      track.appendChild(fill);

      const resetText = document.createElement("span");
      resetText.className = "cgu-reset-text";
      resetText.id = resetId;
      resetText.textContent = "--";

      row.appendChild(rowMeta);
      row.appendChild(track);
      row.appendChild(resetText);
      return row;
    }

    body.appendChild(makeRow("5-hour", "cgu-val-5h", "cgu-bar-5h", "cgu-reset-5h"));
    body.appendChild(makeRow("Weekly", "cgu-val-weekly", "cgu-bar-weekly", "cgu-reset-weekly"));

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);

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

    if (primary && typeof primary.used_percent === "number") {
      const pLeft = calculatePercentLeft(primary.used_percent);
      primaryStatus = getStatusLevel(pLeft);

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
