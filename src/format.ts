// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Formatting helpers. All pure so they are trivially unit-tested.

/** Compact currency: $1.2B, $340.0M, $12.5K, $980. */
export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Full currency with thousands separators: $1,234,567. */
export function moneyFull(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-AU');
}

/** Plain integer with separators. */
export function num(n: number): string {
  return Math.round(n).toLocaleString('en-AU');
}

/** Percentage with one decimal, guarding divide-by-zero. */
export function pct(part: number, whole: number): string {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** 'YYYY-MM-DD' → '12 Mar 2025'. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyDate(iso: string): string {
  if (!iso || iso.length < 10) return iso || '—';
  const y = iso.slice(0, 4);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  if (!m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** 'YYYY-MM' → 'Mar 2025'. */
export function prettyMonth(ym: string): string {
  const y = ym.slice(0, 4);
  const m = parseInt(ym.slice(5, 7), 10);
  if (!m) return ym;
  return `${MONTHS[m - 1]} ${y}`;
}

/** Relative "2h ago" style for a full ISO timestamp; falls back to date. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return prettyDate(iso.slice(0, 10));
}

/** Deterministic colour for a UNSPSC segment code (stable across all views). */
const SEG_PALETTE = [
  '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#0891b2', '#65a30d', '#ca8a04', '#dc2626', '#4f46e5',
  '#059669', '#9333ea', '#e11d48', '#0284c7', '#b45309',
];
export function segColor(seg: string): string {
  let h = 0;
  for (let i = 0; i < seg.length; i++) h = (h * 31 + seg.charCodeAt(i)) >>> 0;
  return SEG_PALETTE[h % SEG_PALETTE.length];
}

export const METHOD_COLORS = ['#d97706', '#0d9488', '#6366f1', '#94a3b8'];
