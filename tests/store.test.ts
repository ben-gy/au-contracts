import { describe, expect, it } from 'vitest';
import { filterTable, segNameMap, DEFAULT_TABLE_FILTERS } from '../src/store.ts';
import { AMT, DATE, type ContractTable, type TableFilters } from '../src/types.ts';

const table: ContractTable = {
  suppliers: ['Acme Pty Ltd', 'Beta Consulting', 'Gamma Defence'],
  agencies: ['Department of Defence', 'Health Agency'],
  states: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'Overseas', 'Unknown'],
  methods: ['Limited tender', 'Open tender', 'Prequalified tender', 'Other'],
  segs: [['43', 'Information Technology & Telecoms'], ['80', 'Management & Business Professional Services']],
  // Rows arrive pre-sorted by value descending, as aggregate.mjs emits them.
  rows: [
    [2, 0, 9_000_000, '2025-11-20', '43', 0, 6, 'Naval systems', 'CN3'],
    [0, 0, 5_000_000, '2026-01-10', '43', 0, 0, 'IT support services', 'CN1'],
    [1, 1, 2_000_000, '2026-03-01', '80', 1, 1, 'Management advisory', 'CN2'],
  ],
};

const f = (over: Partial<TableFilters> = {}): TableFilters => ({ ...DEFAULT_TABLE_FILTERS, ...over });

describe('filterTable', () => {
  it('returns all rows sorted by value by default', () => {
    const out = filterTable(table, f());
    expect(out.length).toBe(3);
    expect(out[0][AMT]).toBe(9_000_000);
  });

  it('filters by search across supplier/agency/description', () => {
    expect(filterTable(table, f({ search: 'naval' })).length).toBe(1);
    expect(filterTable(table, f({ search: 'defence' })).length).toBe(2); // supplier + agency
    expect(filterTable(table, f({ search: 'zzz' })).length).toBe(0);
  });

  it('filters by category segment', () => {
    const out = filterTable(table, f({ seg: '43' }));
    expect(out.length).toBe(2);
    expect(out.every((r) => r[4] === '43')).toBe(true);
  });

  it('filters by method', () => {
    expect(filterTable(table, f({ method: 1 })).length).toBe(1);
    expect(filterTable(table, f({ method: 0 })).length).toBe(2);
  });

  it('filters by state', () => {
    expect(filterTable(table, f({ state: 6 })).length).toBe(1);
    expect(filterTable(table, f({ state: 0 })).length).toBe(1);
  });

  it('sorts by date newest first', () => {
    const out = filterTable(table, f({ sort: 'date' }));
    expect(out[0][DATE]).toBe('2026-03-01');
    expect(out[out.length - 1][DATE]).toBe('2025-11-20');
  });

  it('combines filters', () => {
    const out = filterTable(table, f({ seg: '43', method: 0 }));
    expect(out.length).toBe(2);
  });
});

describe('segNameMap', () => {
  it('builds a lookup', () => {
    const m = segNameMap(table.segs);
    expect(m.get('43')).toBe('Information Technology & Telecoms');
    expect(m.get('99')).toBeUndefined();
  });
});
