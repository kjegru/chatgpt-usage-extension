import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("popup.html: contains all DOM elements queried by popup.js", () => {
  const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
  const popupJs = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");

  // Extract all getElementById calls
  const idRegex = /getElementById\(["']([^"']+)["']\)/g;
  const queriedIds = new Set();
  let match;
  while ((match = idRegex.exec(popupJs)) !== null) {
    queriedIds.add(match[1]);
  }

  // "fallback-message" is dynamically created in popup.js if not present
  queriedIds.delete("fallback-message");

  for (const id of queriedIds) {
    const hasId = popupHtml.includes(`id="${id}"`) || popupHtml.includes(`id='${id}'`);
    assert.ok(hasId, `popup.html is missing required element id="${id}" expected by popup.js`);
  }

  // Check required classes
  assert.ok(popupHtml.includes('class="limit-list"'), 'popup.html must include .limit-list');
  assert.ok(popupHtml.includes('class="limit-row"'), 'popup.html must include .limit-row');
});

test("popup.html: references valid popup.js and popup.css", () => {
  const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
  assert.ok(popupHtml.includes('src="popup.js"'), 'popup.html must link popup.js');
  assert.ok(popupHtml.includes('href="popup.css"'), 'popup.html must link popup.css');
  assert.ok(fs.existsSync(path.join(ROOT, "popup.js")), "popup.js must exist");
  assert.ok(fs.existsSync(path.join(ROOT, "popup.css")), "popup.css must exist");
});

test("content.js: widget template contains all expected control and meter IDs", () => {
  const contentJs = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");

  const expectedIds = [
    "chatgpt-usage-floating-widget",
    "cgu-toggle-header",
    "cgu-status-dot",
    "cgu-header-title",
    "cgu-minimize-btn",
    "cgu-val-5h",
    "cgu-bar-5h",
    "cgu-reset-5h",
    "cgu-val-weekly",
    "cgu-bar-weekly",
    "cgu-reset-weekly"
  ];

  for (const id of expectedIds) {
    assert.ok(contentJs.includes(id), `content.js widget template is missing id="${id}"`);
  }
});
