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
  return Math.round(100 - used);
}
