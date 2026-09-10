/**
 * Converts seconds into formats like "1h 37m", "45m", or "6d 15h".
 *
 * @param {number} seconds
 * @returns {string}
 */
export function formatResetTime(seconds) {
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

/**
 * Formats badge text to strictly stay within 4 characters.
 *
 * @param {string} prefix
 * @param {number} percent
 * @returns {string}
 */
export function formatBadgeText(prefix, percent) {
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  if (p >= 100) return `${prefix}100`;
  return `${prefix}:${p}`;
}

/**
 * Returns remaining percentage rounded to whole number (100 - usedPercent).
 *
 * @param {number} usedPercent
 * @returns {number}
 */
export function calculatePercentLeft(usedPercent) {
  const used = typeof usedPercent === 'number' ? usedPercent : Number(usedPercent);
  if (Number.isNaN(used)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(100 - used)));
}

/**
 * Status colors:
 * > 30% left: green
 * 15% - 30% left: yellow
 * < 15% left: red
 */
export const STATUS_COLORS = {
  GREEN: "#10a37f",
  YELLOW: "#f59e0b",
  RED: "#ef4444"
};

/**
 * Returns status level ('green' | 'yellow' | 'red') for a remaining percentage.
 *
 * @param {number} percentLeft
 * @returns {'green' | 'yellow' | 'red'}
 */
export function getStatusLevel(percentLeft) {
  if (percentLeft < 15) return 'red';
  if (percentLeft <= 30) return 'yellow';
  return 'green';
}

/**
 * Combines two status levels and returns the worst ('red' > 'yellow' > 'green').
 *
 * @param {'green' | 'yellow' | 'red'} level1
 * @param {'green' | 'yellow' | 'red'} level2
 * @returns {'green' | 'yellow' | 'red'}
 */
export function getWorstStatus(level1, level2) {
  if (level1 === 'red' || level2 === 'red') return 'red';
  if (level1 === 'yellow' || level2 === 'yellow') return 'yellow';
  return 'green';
}
