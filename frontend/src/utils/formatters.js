/**
 * Formats large currency amounts into Indian/Standard full format per new requirement
 * Previously compact format (B/M), now redirects to full exact INR.
 */
export function formatCurrencyCompact(amount) {
  return formatCurrencyFull(amount);
}

/**
 * Compact INR formatter specifically for Chart Y-Axes
 * Uses standard M/B suffixes to keep axis readable without breaking Layout.
 */
export function formatAxisCompact(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Number(amount);
  const absNum = Math.abs(num);

  if (absNum >= 1_000_000_000) {
    return `₹${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (absNum >= 1_000_000) {
    return `₹${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (absNum >= 1_000) {
    return `₹${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `₹${num}`;
}

/**
 * Formats full numeric values into standard INR currency strings:
 * e.g., 8494679.02 -> ₹8,494,679.02
 */
export function formatCurrencyFull(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

/**
 * Formats integer numbers with commas: e.g. 170517 -> 170,517
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-IN').format(Number(num));
}

/**
 * Formats probability floats (0.0 to 1.0) or percentages (0 to 100) to standard %:
 * e.g., 0.99637 -> 99.64%
 */
export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const num = Number(value);
  // Handle both 0-1 probability and 0-100 percentage
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(2)}%`;
}

/**
 * Get priority badge class name and styling metadata
 */
export function getPriorityMeta(priority) {
  const p = String(priority || '').toLowerCase();
  switch (p) {
    case 'critical':
      return { label: 'Critical', bg: 'bg-red-100', text: 'text-red-800', badgeClass: 'badge-critical' };
    case 'high':
      return { label: 'High', bg: 'bg-orange-100', text: 'text-orange-800', badgeClass: 'badge-high' };
    case 'medium':
      return { label: 'Medium', bg: 'bg-amber-100', text: 'text-amber-800', badgeClass: 'badge-medium' };
    case 'low':
    default:
      return { label: 'Low', bg: 'bg-emerald-100', text: 'text-emerald-800', badgeClass: 'badge-low' };
  }
}
