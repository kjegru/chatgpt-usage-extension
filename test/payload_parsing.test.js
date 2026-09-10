import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePercentLeft, formatResetTime, getStatusLevel, formatBadgeText } from "../utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("payload: usage.json matches expected schema and can be processed", () => {
  const raw = fs.readFileSync(path.join(ROOT, "usage.json"), "utf8");
  const data = JSON.parse(raw);

  assert.ok(data.rate_limit, "Payload must contain rate_limit");
  const { primary_window, secondary_window } = data.rate_limit;

  assert.ok(primary_window, "Primary window must exist");
  assert.equal(typeof primary_window.used_percent, "number");
  assert.equal(typeof primary_window.reset_after_seconds, "number");

  const primaryLeft = calculatePercentLeft(primary_window.used_percent);
  assert.ok(primaryLeft >= 0 && primaryLeft <= 100);
  assert.match(formatResetTime(primary_window.reset_after_seconds), /^\d+[mh]/);

  assert.ok(secondary_window, "Secondary window must exist");
  assert.equal(typeof secondary_window.used_percent, "number");
  assert.equal(typeof secondary_window.reset_after_seconds, "number");

  const secondaryLeft = calculatePercentLeft(secondary_window.used_percent);
  assert.ok(secondaryLeft >= 0 && secondaryLeft <= 100);
  assert.match(formatResetTime(secondary_window.reset_after_seconds), /^\d+[dh]/);
});

test("payload: handles partial / degraded API payloads gracefully", () => {
  // Only primary window returned
  const partialPrimary = {
    rate_limit: {
      primary_window: { used_percent: 50, reset_after_seconds: 1200 }
    }
  };
  assert.equal(calculatePercentLeft(partialPrimary.rate_limit.primary_window.used_percent), 50);
  assert.equal(partialPrimary.rate_limit.secondary_window, undefined);

  // Missing rate_limit altogether
  const emptyPayload = {};
  assert.equal(emptyPayload.rate_limit, undefined);
});

test("badge text formatting: stays within Chrome's 4-character badge limit", () => {
  assert.equal(formatBadgeText("5", 87), "5:87");
  assert.ok(formatBadgeText("5", 87).length <= 4);

  assert.equal(formatBadgeText("w", 5), "w:5");
  assert.ok(formatBadgeText("w", 5).length <= 4);

  assert.equal(formatBadgeText("5", 100), "5100");
  assert.ok(formatBadgeText("5", 100).length <= 4);
});
