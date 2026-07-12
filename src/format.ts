// Pure formatting helpers. Fully unit-tested.

/** Format a whole-dollar amount compactly: $1.2B, $34.5M, $12.3K, $945. */
export function money(n: number): string {
  const v = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (v >= 1e9) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${sign}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${sign}$${(v / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(v)}`;
}

/** Full dollar amount with thousands separators: $1,234,567. */
export function moneyFull(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString('en-AU')}`;
}

/** Integer with locale separators. */
export function num(n: number): string {
  return Math.round(n).toLocaleString('en-AU');
}

/** Percentage from a 0..1 ratio. */
export function pct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** "2024-06" -> "Jun 2024". Returns input on parse failure. */
export function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${months[idx]} ${m[1]}`;
}

/** "2025-06-30" -> "30 Jun 2025". Returns input on parse failure. */
export function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) return iso;
  return `${Number(m[3])} ${months[idx]} ${m[1]}`;
}

/** Australian financial year label from an ISO date: 2024-08-15 -> "2024-25". */
export function financialYear(iso: string): string {
  const y = Number((iso || '').slice(0, 4));
  const mo = Number((iso || '').slice(5, 7));
  if (!y || !mo) return '—';
  const start = mo >= 7 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Truncate a string to n chars with an ellipsis. */
export function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Escape text for safe insertion into innerHTML. */
export function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
