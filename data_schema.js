/**
 * @typedef {Object} RateLimitWindow
 * @property {number} used_percent
 * @property {number} limit_window_seconds
 * @property {number} reset_after_seconds
 * @property {number} reset_at
 */

/**
 * @typedef {Object} RateLimit
 * @property {RateLimitWindow} primary_window
 * @property {RateLimitWindow} secondary_window
 */

/**
 * @typedef {Object} UsageData
 * @property {RateLimit} rate_limit
 */

export {};
