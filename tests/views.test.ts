import { describe, expect, it } from 'vitest';
import type { Dataset } from '../src/types';
import {
  renderOverview, renderSuppliers, renderAgencies, renderCategories, renderConsulting,
  renderBiggest, renderNetwork, renderFlow, renderMatrix, renderMap, renderInsights, type ViewCtx,
} from '../src/views';

function mockData(): Dataset {
  return {
    meta: {
      generated: '2026-07-12', periodStart: '2023-07-01', periodEnd: '2025-06-30',
      totalValue: 126_760_000_000, totalContracts: 121029, supplierCount: 34102, agencyCount: 131,
      categoryCount: 40, consultingTotal: 53_870_000_000, consultingShare: 0.425,
      fyList: [{ fy: '2023-24', total: 60e9, count: 60000 }, { fy: '2024-25', total: 66e9, count: 61029 }],
      methods: [{ name: 'Open tender', total: 40e9 }, { name: 'Limited tender', total: 30e9 }],
      states: [{ state: 'ACT', total: 50e9, count: 40000 }, { state: 'NSW', total: 30e9, count: 30000 }],
    },
    suppliers: [
      { slug: 'acme', name: 'Acme Pty Ltd', abn: '111', state: 'NSW', total: 5e9, count: 89, agencies: 12, cat: '46', avg: 5e7, max: 1e9 },
      { slug: 'globex', name: 'Globex', abn: '222', state: 'VIC', total: 2e9, count: 3, agencies: 2, cat: '80', avg: 6e8, max: 1e9 },
    ],
    suppliersDetail: {
      acme: { name: 'Acme Pty Ltd', abn: '111', state: 'NSW', total: 5e9, count: 89, avg: 5e7, max: 1e9, agencies: [{ name: 'Defence', total: 4e9 }], cats: [{ seg: '46', name: 'Defence', total: 5e9 }], months: [{ m: '2024-06', total: 1e9 }] },
    },
    agencies: [
      { slug: 'defence', name: 'Department of Defence', total: 67e9, count: 46133, avg: 1.4e6, suppliers: 5000, topSuppliers: [{ name: 'Acme Pty Ltd', total: 5e9 }], cats: [{ seg: '46', name: 'Defence', total: 40e9 }], months: [{ m: '2024-06', total: 5e9 }], methods: [{ name: 'Open tender', total: 30e9 }] },
    ],
    categories: [
      { seg: '80', name: 'Management & Business Professional Services', total: 33e9, count: 20000, consulting: true, topSuppliers: [{ name: 'Accenture', total: 0.8e9 }], topAgencies: [{ name: 'Defence', total: 10e9 }] },
      { seg: '25', name: 'Vehicles & Transport', total: 21e9, count: 5000, consulting: false, topSuppliers: [{ name: 'Hanwha', total: 5e9 }], topAgencies: [{ name: 'Defence', total: 20e9 }] },
    ],
    monthly: [{ m: '2024-05', total: 4e9, count: 5000 }, { m: '2024-06', total: 10e9, count: 10000 }],
    largest: [
      { id: 'CN1', title: 'Naval build', amount: 5e9, supplier: 'Acme Pty Ltd', agency: 'Department of Defence', seg: '46', cat: 'Defence', signed: '2024-06-01', method: 'Limited tender', pStart: '2024-06-01', pEnd: '2028-06-01', state: 'NSW' },
    ],
    network: { suppliers: [{ name: 'Acme Pty Ltd', total: 5e9, cat: '46' }], agencies: [{ name: 'Department of Defence', total: 67e9 }], edges: [{ s: 'Acme Pty Ltd', a: 'Department of Defence', total: 4e9 }] },
    flows: { segments: [{ seg: '80', name: 'Prof services', total: 33e9 }], agencies: [{ name: 'Department of Defence', total: 67e9 }], links: [{ seg: '80', agency: 'Department of Defence', total: 10e9 }] },
    matrix: { agencies: [{ name: 'Department of Defence', slug: 'defence', total: 67e9 }], segments: [{ seg: '46', name: 'Defence' }], cells: [[40e9]] },
    consulting: {
      total: 53e9, share: 0.425, byFy: [{ fy: '2023-24', total: 25e9 }, { fy: '2024-25', total: 28e9 }],
      topSuppliers: [{ name: 'Accenture', slug: 'accenture', total: 0.8e9 }],
      bigFirms: [{ name: 'Accenture', total: 876e6, count: 109 }, { name: 'PwC', total: 2.6e6, count: 18 }],
      segments: [{ seg: '80', name: 'Management', total: 33e9 }],
    },
    insights: [
      { severity: 'warn', kind: 'concentration', title: 'Home Affairs: one supplier holds 56%', detail: 'x', agency: 'home-affairs' },
      { severity: 'info', kind: 'megasupplier', title: 'Acme won $5B', detail: 'y', supplier: 'acme' },
    ],
  };
}

function ctx(): ViewCtx {
  return { data: mockData(), search: '', openSupplier: () => {}, openAgency: () => {}, setTab: () => {} };
}

const views: [string, (c: ViewCtx) => HTMLElement][] = [
  ['overview', renderOverview], ['suppliers', renderSuppliers], ['agencies', renderAgencies],
  ['categories', renderCategories], ['consulting', renderConsulting], ['biggest', renderBiggest],
  ['network', renderNetwork], ['flow', renderFlow], ['matrix', renderMatrix], ['map', renderMap],
  ['insights', renderInsights],
];

describe('views render without throwing', () => {
  for (const [name, fn] of views) {
    it(`renders ${name}`, () => {
      const node = fn(ctx());
      expect(node).toBeInstanceOf(HTMLElement);
      expect(node.querySelector('.view-head')).not.toBeNull();
    });
  }
});

describe('view content', () => {
  it('overview shows total value', () => {
    expect(renderOverview(ctx()).textContent).toContain('$126.76B');
  });
  it('suppliers table lists a supplier', () => {
    expect(renderSuppliers(ctx()).textContent).toContain('Acme Pty Ltd');
  });
  it('consulting shows PwC collapse figure', () => {
    expect(renderConsulting(ctx()).textContent).toContain('PwC');
  });
  it('biggest lists the naval contract', () => {
    expect(renderBiggest(ctx()).textContent).toContain('Naval build');
  });
  it('search term filters suppliers', () => {
    const c = ctx(); c.search = 'globex';
    const node = renderSuppliers(c);
    expect(node.textContent).toContain('Globex');
    expect(node.textContent).not.toContain('Acme Pty Ltd');
  });
});
