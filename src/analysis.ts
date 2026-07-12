// Pure analysis / query helpers over the dataset. Fully unit-tested.
import type { Supplier, Agency, Contract } from './types';

/** Case-insensitive substring filter over supplier name/state/ABN. */
export function filterSuppliers(list: Supplier[], q: string): Supplier[] {
  const term = q.trim().toLowerCase();
  if (!term) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      (s.state || '').toLowerCase().includes(term) ||
      (s.abn || '').includes(term),
  );
}

export function filterAgencies(list: Agency[], q: string): Agency[] {
  const term = q.trim().toLowerCase();
  if (!term) return list;
  return list.filter((a) => a.name.toLowerCase().includes(term));
}

export function filterContracts(list: Contract[], q: string): Contract[] {
  const term = q.trim().toLowerCase();
  if (!term) return list;
  return list.filter(
    (c) =>
      c.title.toLowerCase().includes(term) ||
      c.supplier.toLowerCase().includes(term) ||
      c.agency.toLowerCase().includes(term) ||
      c.cat.toLowerCase().includes(term),
  );
}

export type SortDir = 'asc' | 'desc';

/** Generic stable-ish sort by a numeric or string key. */
export function sortBy<T>(list: T[], key: keyof T, dir: SortDir): T[] {
  const out = [...list];
  out.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
  return out;
}

/** Share of total held by the top n items (by `total` field), as a 0..1 ratio. */
export function concentration(items: { total: number }[], n: number): number {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const grand = sorted.reduce((s, x) => s + x.total, 0);
  if (grand <= 0) return 0;
  const top = sorted.slice(0, n).reduce((s, x) => s + x.total, 0);
  return top / grand;
}

/** Median of a numeric array (returns 0 for empty). */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Simple pagination slice. */
export function page<T>(list: T[], pageIndex: number, size: number): T[] {
  const start = pageIndex * size;
  return list.slice(start, start + size);
}

/** Total of a `total` field across items. */
export function sumTotal(items: { total: number }[]): number {
  return items.reduce((s, x) => s + x.total, 0);
}
