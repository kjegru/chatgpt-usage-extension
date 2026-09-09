import test from "node:test";
import assert from "node:assert/strict";
import {
  formatResetTime,
  calculatePercentLeft,
  STATUS_COLORS,
  getStatusLevel,
  getWorstStatus,
} from "../utils.js";

test("calculatePercentLeft: converts used percent to remaining percent correctly", () => {
  assert.equal(calculatePercentLeft(0), 100);
  assert.equal(calculatePercentLeft(20), 80);
  assert.equal(calculatePercentLeft(65.4), 35);
  assert.equal(calculatePercentLeft(100), 0);
});

test("calculatePercentLeft: handles edge cases (overflow, negatives, non-numbers)", () => {
  assert.equal(calculatePercentLeft(110), 0, "should clamp overflow to 0");
  assert.equal(calculatePercentLeft(-10), 100, "should clamp negative usage to 100");
  assert.equal(calculatePercentLeft("30"), 70, "should parse string number");
  assert.equal(calculatePercentLeft(NaN), 0, "should handle NaN");
  assert.equal(calculatePercentLeft(null), 100, "Number(null) is 0 so 100% left");
  assert.equal(calculatePercentLeft(undefined), 0, "Number(undefined) is NaN so 0% left");
});

test("formatResetTime: formats minutes, hours, days correctly", () => {
  // Sub-minute / zero
  assert.equal(formatResetTime(0), "0m");
  assert.equal(formatResetTime(30), "0m");

  // Minutes only (< 1 hour)
  assert.equal(formatResetTime(60), "1m");
  assert.equal(formatResetTime(45 * 60), "45m");
  assert.equal(formatResetTime(59 * 60 + 59), "59m");

  // Hours and minutes
  assert.equal(formatResetTime(3600), "1h");
  assert.equal(formatResetTime(3600 + 120), "1h 2m");
  assert.equal(formatResetTime(5 * 3600 + 37 * 60), "5h 37m");

  // Days and hours
  assert.equal(formatResetTime(86400), "1d");
  assert.equal(formatResetTime(86400 + 3600), "1d 1h");
  assert.equal(formatResetTime(6 * 86400 + 15 * 3600), "6d 15h");

  // Invalid inputs
  assert.equal(formatResetTime(-100), "0m");
  assert.equal(formatResetTime("invalid"), "0m");
});

test("getStatusLevel: evaluates threshold boundaries accurately", () => {
  assert.equal(getStatusLevel(0), "red");
  assert.equal(getStatusLevel(14), "red");
  assert.equal(getStatusLevel(14.9), "red");

  // 15% to 30% is yellow
  assert.equal(getStatusLevel(15), "yellow");
  assert.equal(getStatusLevel(25), "yellow");
  assert.equal(getStatusLevel(30), "yellow");

  // > 30% is green
  assert.equal(getStatusLevel(30.1), "green");
  assert.equal(getStatusLevel(50), "green");
  assert.equal(getStatusLevel(100), "green");
});

test("getWorstStatus: prioritizes red > yellow > green", () => {
  assert.equal(getWorstStatus("green", "green"), "green");
  assert.equal(getWorstStatus("green", "yellow"), "yellow");
  assert.equal(getWorstStatus("yellow", "green"), "yellow");
  assert.equal(getWorstStatus("yellow", "yellow"), "yellow");
  assert.equal(getWorstStatus("red", "green"), "red");
  assert.equal(getWorstStatus("green", "red"), "red");
  assert.equal(getWorstStatus("red", "yellow"), "red");
  assert.equal(getWorstStatus("yellow", "red"), "red");
  assert.equal(getWorstStatus("red", "red"), "red");
});

test("STATUS_COLORS: defines standard hex values", () => {
  assert.ok(STATUS_COLORS.GREEN);
  assert.ok(STATUS_COLORS.YELLOW);
  assert.ok(STATUS_COLORS.RED);
  assert.match(STATUS_COLORS.GREEN, /^#[0-9a-f]{6}$/i);
  assert.match(STATUS_COLORS.YELLOW, /^#[0-9a-f]{6}$/i);
  assert.match(STATUS_COLORS.RED, /^#[0-9a-f]{6}$/i);
});
