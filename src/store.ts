import {
  AG, AMT, DATE, DESC, METHOD, SEG, STATE, SUP,
  type Aggregates, type ContractTable, type TableFilters, type TableRow,
} from './types.ts';

export const DEFAULT_TABLE_FILTERS: TableFilters = {
  search: '',
  seg: '',
  method: -1,
  state: -1,
  sort: 'value',
};

/** Load the precomputed aggregates payload (small, drives most views). */
export async function loadAggregates(signal?: AbortSignal): Promise<Aggregates> {
  const res = await fetch('data/aggregates.json', { signal });
  if (!res.ok) throw new Error(`Failed to load aggregates (HTTP ${res.status})`);
  return (await res.json()) as Aggregates;
}

/** Load the searchable contract table (largest N contracts). Lazy — only the
 *  Contracts view needs it, so it is fetched on first navigation. */
export async function loadTable(signal?: AbortSignal): Promise<ContractTable> {
  const res = await fetch('data/contracts.json', { signal });
  if (!res.ok) throw new Error(`Failed to load contracts (HTTP ${res.status})`);
  return (await res.json()) as ContractTable;
}

/** Build a seg→name lookup from the aggregates segNames list. */
export function segNameMap(segs: [string, string][]): Map<string, string> {
  return new Map(segs);
}

/** Apply table filters + sort, returning the matching rows. Pure. */
export function filterTable(t: ContractTable, f: TableFilters): TableRow[] {
  const q = f.search.trim().toLowerCase();
  let out = t.rows;
  const active = !!f.seg || f.method !== -1 || f.state !== -1 || !!q;
  if (active) {
    out = t.rows.filter((r) => {
      if (f.seg && r[SEG] !== f.seg) return false;
      if (f.method !== -1 && r[METHOD] !== f.method) return false;
      if (f.state !== -1 && r[STATE] !== f.state) return false;
      if (q) {
        const hay =
          t.suppliers[r[SUP]].toLowerCase() + ' ' +
          t.agencies[r[AG]].toLowerCase() + ' ' +
          r[DESC].toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  // rows already arrive sorted by value desc; only re-sort for date.
  if (f.sort === 'date') {
    out = out.slice().sort((a, b) => (a[DATE] < b[DATE] ? 1 : a[DATE] > b[DATE] ? -1 : b[AMT] - a[AMT]));
  } else if (active) {
    out = out.slice().sort((a, b) => b[AMT] - a[AMT]);
  }
  return out;
}
