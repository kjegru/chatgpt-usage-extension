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
  let widgetPosition = null;

  function safeStorageSet(items) {
    try {
      if (typeof chrome === "undefined" || !chrome?.runtime?.id || !chrome?.storage?.local) {
        return;
      }
      const p = chrome.storage.local.set(items, () => {
        if (chrome.runtime?.lastError) {
          // Handled to suppress unhandled lastError warnings
        }
      });
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    } catch (_) {
      // Extension context invalidated or storage unavailable
    }
  }

  function applyPosition(pos) {
    if (!widgetEl || !pos || typeof pos.left !== "number" || typeof pos.top !== "number") return;
    widgetPosition = { left: Math.round(pos.left), top: Math.round(pos.top) };
    widgetEl.style.transformOrigin = "top left";
    widgetEl.style.right = "auto";
    widgetEl.style.bottom = "auto";

    const rect = widgetEl.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const clampedLeft = Math.min(Math.max(0, widgetPosition.left), maxLeft);
    const clampedTop = Math.min(Math.max(0, widgetPosition.top), maxTop);

    widgetEl.style.left = `${clampedLeft}px`;
    widgetEl.style.top = `${clampedTop}px`;
  }

  function resetPosition() {
    widgetPosition = null;
    if (!widgetEl) return;
    widgetEl.style.left = "";
    widgetEl.style.top = "";
    widgetEl.style.right = "";
    widgetEl.style.bottom = "";
    widgetEl.style.transformOrigin = "";
  }

  function clampWidgetPosition() {
    if (!widgetEl) return;
    if (!widgetEl.style.left || !widgetEl.style.top) return;
    const rect = widgetEl.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const curLeft = parseFloat(widgetEl.style.left);
    const curTop = parseFloat(widgetEl.style.top);
    if (Number.isNaN(curLeft) || Number.isNaN(curTop)) return;

    const clampedLeft = Math.min(Math.max(0, Math.round(curLeft)), maxLeft);
    const clampedTop = Math.min(Math.max(0, Math.round(curTop)), maxTop);
    if (clampedLeft !== curLeft || clampedTop !== curTop) {
      widgetEl.style.left = `${clampedLeft}px`;
      widgetEl.style.top = `${clampedTop}px`;
      widgetPosition = { left: clampedLeft, top: clampedTop };
      safeStorageSet({ floatingWidgetPosition: widgetPosition });
    }
  }

  function setupDraggable(container) {
    let isDragging = false;
    let hasMoved = false;
    let wasJustDragged = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let widgetWidth = 0;
    let widgetHeight = 0;

    // Suppress click events if the mouse was dragged
    container.addEventListener(
      "click",
      (e) => {
        if (wasJustDragged) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true
    );

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (e.target.closest("button, .cgu-icon-btn, input, a")) return;

      const rect = container.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      widgetWidth = rect.width;
      widgetHeight = rect.height;
      hasMoved = false;
      isDragging = true;

      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("blur", onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      if (!hasMoved) {
        if (Math.hypot(deltaX, deltaY) < 4) {
          return;
        }
        hasMoved = true;
        container.classList.add("cgu-is-dragging");
        if (document.body) {
          document.body.classList.add("cgu-dragging");
        }
        container.style.transformOrigin = "top left";
        container.style.right = "auto";
        container.style.bottom = "auto";
      }

      e.preventDefault();

      const maxLeft = Math.max(0, window.innerWidth - widgetWidth);
      const maxTop = Math.max(0, window.innerHeight - widgetHeight);
      const nextLeft = Math.min(Math.max(0, Math.round(startLeft + deltaX)), maxLeft);
      const nextTop = Math.min(Math.max(0, Math.round(startTop + deltaY)), maxTop);

      container.style.left = `${nextLeft}px`;
      container.style.top = `${nextTop}px`;
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);

      if (hasMoved) {
        container.classList.remove("cgu-is-dragging");
        if (document.body) {
          document.body.classList.remove("cgu-dragging");
        }
        wasJustDragged = true;
        setTimeout(() => {
          wasJustDragged = false;
        }, 80);

        const finalLeft = parseFloat(container.style.left);
        const finalTop = parseFloat(container.style.top);
        if (!Number.isNaN(finalLeft) && !Number.isNaN(finalTop)) {
          widgetPosition = { left: Math.round(finalLeft), top: Math.round(finalTop) };
          safeStorageSet({ floatingWidgetPosition: widgetPosition });
        }
      }
    }

    container.addEventListener("pointerdown", onPointerDown);
  }

  function updateHeaderTitle() {
    if (!widgetEl) {
      widgetEl = document.getElementById("chatgpt-usage-floating-widget");
    }
    if (!widgetEl) return;
    const headerTitle = widgetEl.querySelector("#cgu-header-title");
    if (!headerTitle) return;

    if (!isMinimized || !cachedPayload?.rate_limit) {
      headerTitle.textContent = "Usage Limits";
      return;
    }

    try {
      const primary = cachedPayload.rate_limit.primary_window;
      const secondary = cachedPayload.rate_limit.secondary_window;
      const pText = primary && typeof primary.used_percent === "number"
        ? `${calculatePercentLeft(primary.used_percent)}%`
        : "--";
      const sText = secondary && typeof secondary.used_percent === "number"
        ? `${calculatePercentLeft(secondary.used_percent)}%`
        : "--";

      headerTitle.textContent = `5: ${pText} | W: ${sText}`;
    } catch (_) {
      headerTitle.textContent = "Usage Limits";
    }
  }

  function toggleMinimize() {
    isMinimized = !isMinimized;
    if (!widgetEl) {
      widgetEl = document.getElementById("chatgpt-usage-floating-widget");
    }
    if (widgetEl) {
      widgetEl.classList.toggle("cgu-minimized", isMinimized);
      if (widgetPosition || widgetEl.style.left) {
        clampWidgetPosition();
      }
    }
    updateHeaderTitle();
    safeStorageSet({ floatingWidgetMinimized: isMinimized });
  }

  const SCALE_STEPS = [0.75, 0.85, 1.0, 1.15, 1.30, 1.50];
  const DEFAULT_SCALE_INDEX = 2;
  let scaleIndex = DEFAULT_SCALE_INDEX;

  function updateScaleButtons() {
    if (!widgetEl) return;
    const zoomOut = widgetEl.querySelector("#cgu-zoom-out-btn");
    const zoomIn = widgetEl.querySelector("#cgu-zoom-in-btn");
    if (zoomOut) {
      const atMin = scaleIndex <= 0;
      zoomOut.disabled = atMin;
      zoomOut.style.opacity = atMin ? "0.25" : "";
      zoomOut.style.cursor = atMin ? "not-allowed" : "pointer";
      zoomOut.title = atMin
        ? "Minimum size reached"
        : `Decrease size (${Math.round(SCALE_STEPS[scaleIndex - 1] * 100)}%)`;
    }
    if (zoomIn) {
      const atMax = scaleIndex >= SCALE_STEPS.length - 1;
      zoomIn.disabled = atMax;
      zoomIn.style.opacity = atMax ? "0.25" : "";
      zoomIn.style.cursor = atMax ? "not-allowed" : "pointer";
      zoomIn.title = atMax
        ? "Maximum size reached"
        : `Increase size (${Math.round(SCALE_STEPS[scaleIndex + 1] * 100)}%)`;
    }
  }

  function applyScale() {
    if (!widgetEl) return;
    widgetEl.style.transform = `scale(${SCALE_STEPS[scaleIndex]})`;
    if (widgetPosition || widgetEl.style.left) {
      widgetEl.style.transformOrigin = "top left";
      clampWidgetPosition();
    }
    updateScaleButtons();
  }

  function changeScale(delta) {
    const next = scaleIndex + delta;
    if (next < 0 || next >= SCALE_STEPS.length) return;
    scaleIndex = next;
    applyScale();
    safeStorageSet({ floatingWidgetScaleIndex: scaleIndex });
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

    // Controls (zoom out, zoom in, and minimize button)
    const controls = document.createElement("div");
    controls.className = "cgu-controls";

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "cgu-icon-btn";
    zoomOutBtn.id = "cgu-zoom-out-btn";
    zoomOutBtn.title = "Decrease size";
    zoomOutBtn.textContent = "−";

    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "cgu-icon-btn";
    zoomInBtn.id = "cgu-zoom-in-btn";
    zoomInBtn.title = "Increase size";
    zoomInBtn.textContent = "+";

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
    controls.appendChild(zoomOutBtn);
    controls.appendChild(zoomInBtn);
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
    setupDraggable(container);

    const targetParent = document.body || document.documentElement;
    targetParent.appendChild(container);

    zoomOutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeScale(-1);
    });

    zoomInBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      changeScale(1);
    });

    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    titleGroup.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    container.style.transform = `scale(${SCALE_STEPS[scaleIndex]})`;

    return container;
  }

  function getWidget() {
    if (!widgetEl || !document.contains(widgetEl)) {
      widgetEl = createWidget();
      applyScale();
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
    try {
      if (typeof window !== "undefined") {
        window.addEventListener("resize", clampWidgetPosition);
      }
    } catch (_) {}

    try {
      if (typeof chrome === "undefined" || !chrome?.runtime?.id || !chrome?.storage?.local) {
        return;
      }
      chrome.storage.local.get(
        ["usagePayload", "floatingWidgetEnabled", "floatingWidgetMinimized", "floatingWidgetScaleIndex", "floatingWidgetPosition"],
        (res) => {
          if (chrome.runtime?.lastError || !res) return;

          if (typeof res.floatingWidgetScaleIndex === "number") {
            scaleIndex = Math.max(0, Math.min(SCALE_STEPS.length - 1, res.floatingWidgetScaleIndex));
          }

          widgetEl = getWidget();
          applyScale();

          if (res.floatingWidgetMinimized) {
            isMinimized = true;
            widgetEl.classList.add("cgu-minimized");
          }

          if (res.floatingWidgetPosition) {
            applyPosition(res.floatingWidgetPosition);
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
    } catch (_) {
      // Extension context invalidated
    }

    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.onChanged) {
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
                if (widgetPosition || widgetEl.style.left) {
                  clampWidgetPosition();
                }
              }
              updateHeaderTitle();
            }
            if (changes.floatingWidgetScaleIndex !== undefined) {
              const idx = changes.floatingWidgetScaleIndex.newValue;
              if (typeof idx === "number") {
                scaleIndex = Math.max(0, Math.min(SCALE_STEPS.length - 1, idx));
                applyScale();
              }
            }
            if (changes.floatingWidgetPosition !== undefined) {
              if (changes.floatingWidgetPosition.newValue) {
                applyPosition(changes.floatingWidgetPosition.newValue);
              } else {
                resetPosition();
              }
            }
          }
        });
      }
    } catch (_) {
      // Extension context invalidated
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
