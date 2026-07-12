// Fixed qualitative palette for UNSPSC segments, used consistently across every view.
// Keyed by segment (first two digits of UNSPSC). Unmapped segments fall back to a hash.

const PALETTE = [
  '#0f6fc6', '#e8792b', '#2ca089', '#c0392b', '#7b5ea7',
  '#c69214', '#4a90d9', '#d1477a', '#5a9e3a', '#8b6d3f',
  '#3aa0a0', '#b5522f', '#6c7ae0', '#c0a020', '#357a4c',
  '#a0508b', '#4682b4', '#cc6666', '#549e6a', '#9a7d4a',
];

// Curated colours for the biggest / most recognisable segments so the legend reads well.
const FIXED: Record<string, string> = {
  '43': '#0f6fc6', // IT & Telecommunications — blue
  '80': '#e8792b', // Management & Business Professional Services — orange (consulting)
  '46': '#c0392b', // Defence, Security & Safety — red
  '81': '#7b5ea7', // Engineering & Research — purple
  '72': '#8b6d3f', // Building & Construction Services — brown
  '85': '#2ca089', // Healthcare Services — teal
  '86': '#d1477a', // Education & Training — pink
  '25': '#5a9e3a', // Vehicles & Transport — green
  '84': '#c69214', // Financial & Insurance Services — gold
  '78': '#4a90d9', // Transportation & Logistics — light blue
  '92': '#6b4a2f', // National Defence & Public Order — dark brown
  '42': '#3aa0a0', // Medical Equipment — cyan
};

function hashColor(seg: string): string {
  let h = 0;
  for (let i = 0; i < seg.length; i++) h = (h * 31 + seg.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function segColor(seg: string): string {
  return FIXED[seg] || hashColor(seg || '99');
}

// Severity colours for insights (aligned to CSS custom props).
export const SEVERITY_COLOR: Record<string, string> = {
  alert: 'var(--status-bad)',
  warn: 'var(--status-warn)',
  info: 'var(--status-info)',
};

// Procurement method colours.
export function methodColor(method: string): string {
  const m = method.toLowerCase();
  if (m.includes('open')) return '#2ca089';
  if (m.includes('limited')) return '#c0392b';
  if (m.includes('prequal')) return '#c69214';
  return '#7b8a9a';
}
