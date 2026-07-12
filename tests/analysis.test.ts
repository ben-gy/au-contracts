import { describe, expect, it } from 'vitest';
import { filterSuppliers, filterAgencies, filterContracts, sortBy, concentration, median, page, sumTotal } from '../src/analysis';
import type { Supplier, Agency, Contract } from '../src/types';

const suppliers: Supplier[] = [
  { slug: 'acme', name: 'Acme Pty Ltd', abn: '11111111111', state: 'NSW', total: 500, count: 3, agencies: 2, cat: '43', avg: 166, max: 300 },
  { slug: 'globex', name: 'Globex Corporation', abn: '22222222222', state: 'VIC', total: 900, count: 1, agencies: 1, cat: '80', avg: 900, max: 900 },
  { slug: 'initech', name: 'Initech', abn: '33333333333', state: 'NSW', total: 200, count: 5, agencies: 4, cat: '46', avg: 40, max: 80 },
];

describe('filterSuppliers', () => {
  it('returns all for empty query', () => { expect(filterSuppliers(suppliers, '')).toHaveLength(3); });
  it('matches name case-insensitively', () => { expect(filterSuppliers(suppliers, 'acme')).toHaveLength(1); });
  it('matches state', () => { expect(filterSuppliers(suppliers, 'nsw')).toHaveLength(2); });
  it('matches abn', () => { expect(filterSuppliers(suppliers, '22222')).toHaveLength(1); });
  it('returns empty for no match', () => { expect(filterSuppliers(suppliers, 'zzz')).toHaveLength(0); });
});

describe('filterAgencies', () => {
  const ag: Agency[] = [
    { slug: 'defence', name: 'Department of Defence', total: 1, count: 1, avg: 1, suppliers: 1, topSuppliers: [], cats: [], months: [], methods: [] },
    { slug: 'health', name: 'Department of Health', total: 1, count: 1, avg: 1, suppliers: 1, topSuppliers: [], cats: [], months: [], methods: [] },
  ];
  it('matches by name', () => { expect(filterAgencies(ag, 'defence')).toHaveLength(1); });
  it('empty query returns all', () => { expect(filterAgencies(ag, '')).toHaveLength(2); });
});

describe('filterContracts', () => {
  const cs: Contract[] = [
    { id: 'CN1', title: 'Website audit', amount: 100, supplier: 'Acme', agency: 'Defence', seg: '80', cat: 'Prof', signed: '2024-01-01', method: 'Open tender', pStart: '', pEnd: '', state: 'NSW' },
    { id: 'CN2', title: 'Truck supply', amount: 200, supplier: 'Globex', agency: 'Home Affairs', seg: '25', cat: 'Vehicles', signed: '2024-02-01', method: 'Limited tender', pStart: '', pEnd: '', state: 'VIC' },
  ];
  it('matches title', () => { expect(filterContracts(cs, 'website')).toHaveLength(1); });
  it('matches supplier', () => { expect(filterContracts(cs, 'globex')).toHaveLength(1); });
  it('matches category', () => { expect(filterContracts(cs, 'vehicles')).toHaveLength(1); });
});

describe('sortBy', () => {
  it('sorts numeric desc', () => { expect(sortBy(suppliers, 'total', 'desc')[0].slug).toBe('globex'); });
  it('sorts numeric asc', () => { expect(sortBy(suppliers, 'total', 'asc')[0].slug).toBe('initech'); });
  it('sorts strings asc', () => { expect(sortBy(suppliers, 'name', 'asc')[0].slug).toBe('acme'); });
  it('does not mutate input', () => { const before = suppliers.map((s) => s.slug); sortBy(suppliers, 'total', 'asc'); expect(suppliers.map((s) => s.slug)).toEqual(before); });
});

describe('concentration', () => {
  it('computes top-1 share', () => { expect(concentration([{ total: 80 }, { total: 20 }], 1)).toBeCloseTo(0.8); });
  it('returns 0 for empty', () => { expect(concentration([], 1)).toBe(0); });
  it('returns 1 when n covers all', () => { expect(concentration([{ total: 5 }, { total: 5 }], 2)).toBeCloseTo(1); });
});

describe('median', () => {
  it('odd length', () => { expect(median([3, 1, 2])).toBe(2); });
  it('even length', () => { expect(median([1, 2, 3, 4])).toBe(2.5); });
  it('empty', () => { expect(median([])).toBe(0); });
});

describe('page', () => {
  it('slices a page', () => { expect(page([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]); });
  it('handles out of range', () => { expect(page([1, 2], 5, 2)).toEqual([]); });
});

describe('sumTotal', () => {
  it('sums totals', () => { expect(sumTotal([{ total: 10 }, { total: 5 }])).toBe(15); });
  it('empty is zero', () => { expect(sumTotal([])).toBe(0); });
});
