// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import {
  AG, AMT, DATE, DESC, METHOD, SEG, SUP,
  type Aggregates, type ContractTable, type TableFilters, type TableRow,
} from './types.ts';
import { el, clear, debounce } from './dom.ts';
import { money, moneyFull, num, pct, prettyDate, prettyMonth, segColor, METHOD_COLORS as MC } from './format.ts';
import {
  horizontalBars, treemap, sankey, forceNetwork, heatmap, columns, legend,
  hideTip, showTip,
} from './charts.ts';
import { infoIcon, labelWithInfo } from './ui.ts';
import { filterTable } from './store.ts';
import { renderMap } from './map.ts';
import { attachSvgZoom } from './utils/svgZoom.ts';

export type ViewKey =
  | 'overview' | 'suppliers' | 'agencies' | 'categories' | 'contracts'
  | 'network' | 'flow' | 'matrix' | 'map' | 'trends' | 'insights';

export interface AppContext {
  agg: Aggregates;
  segName: Map<string, string>;
  getTable: () => Promise<ContractTable>;
  navigate: (view: ViewKey) => void;
  openEntity: (kind: 'supplier' | 'agency', name: string) => void;
}

// ── Small shared building blocks ────────────────────────────────────────────

function panel(title: string, subtitle: string, infoKey?: string): HTMLElement {
  const head = el('div', { class: 'panel-head' }, [
    el('h2', { class: 'panel-title' }, infoKey ? [title, infoIcon(infoKey)] : [title]),
    el('p', { class: 'panel-sub' }, [subtitle]),
  ]);
  return head;
}

function statCard(value: string, label: string | HTMLElement, tone = ''): HTMLElement {
  return el('div', { class: 'stat-card' + (tone ? ' ' + tone : '') }, [
    el('div', { class: 'stat-value' }, [value]),
    el('div', { class: 'stat-label' }, [typeof label === 'string' ? document.createTextNode(label) : label]),
  ]);
}

function entityLink(ctx: AppContext, kind: 'supplier' | 'agency', name: string): HTMLElement {
  return el('button', {
    class: 'entity-link',
    onclick: () => ctx.openEntity(kind, name),
    title: `View ${name}`,
  }, [name]);
}

// ── Overview ────────────────────────────────────────────────────────────────

export function renderOverview(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const m = a.meta;
  const wrap = el('div', { class: 'view view-overview' });

  wrap.append(el('div', { class: 'overview-intro' }, [
    el('h1', {}, ['Where Commonwealth money goes']),
    el('p', {}, [
      `Every reportable contract the Australian Government awarded in ${m.fyLabel} (${prettyDate(m.windowFrom)} – ${prettyDate(m.windowTo)}), drawn live from `,
      labelWithInfo('AusTender', 'austender'),
      '. Explore who wins the money, which agencies spend it, and what for.',
    ]),
  ]));

  const limitedShare = a.methods.find((x) => x.code === 0);
  const stats = el('div', { class: 'stat-grid' }, [
    statCard(money(m.totalValue), 'Total contract value'),
    statCard(num(m.count), 'Contracts awarded'),
    statCard(num(m.supplierCount), 'Distinct suppliers'),
    statCard(num(m.agencyCount), 'Government agencies'),
    statCard(
      limitedShare ? pct(limitedShare.value, m.totalValue) : '—',
      labelWithInfo('Value via limited tender', 'limited-tender'),
      limitedShare && limitedShare.value / m.totalValue > 0.35 ? 'warn' : ''
    ),
  ]);
  wrap.append(stats);

  // Notable findings (top 3)
  const insights = el('div', { class: 'overview-cols' });
  const findingsCol = el('div', { class: 'overview-col' }, [
    panel('Notable findings', 'Auto-detected from this year’s data'),
  ]);
  a.findings.slice(0, 4).forEach((f) => findingsCol.append(findingCard(f)));
  findingsCol.append(el('button', { class: 'link-more', onclick: () => ctx.navigate('insights') }, ['All insights →']));
  insights.append(findingsCol);

  // Top suppliers + agencies mini leaderboards
  const right = el('div', { class: 'overview-col' });
  right.append(panel('Biggest suppliers', 'By total contract value', 'supplier'));
  right.append(horizontalBars(
    a.topSuppliers.slice(0, 8).map((s) => ({
      label: s.name, value: s.value,
      color: segColor(s.topSeg || '00'),
      onClick: () => ctx.openEntity('supplier', s.name),
      meta: `${num(s.count)} contracts · ${s.agencies} ${s.agencies === 1 ? 'agency' : 'agencies'}`,
    }))
  ));
  right.append(el('button', { class: 'link-more', onclick: () => ctx.navigate('suppliers') }, ['Full supplier leaderboard →']));
  insights.append(right);
  wrap.append(insights);

  // Monthly mini trend
  wrap.append(panel('Spending by month', `Total committed value per month across ${m.fyLabel}`));
  wrap.append(columns(a.monthly.map((mo) => ({ label: prettyMonth(mo.ym).slice(0, 3), value: mo.value, sub: `${num(mo.count)} contracts` })), 180));

  return wrap;
}

function findingCard(f: { severity: string; title: string; detail: string }): HTMLElement {
  return el('div', { class: 'finding finding-' + f.severity }, [
    el('div', { class: 'finding-title' }, [f.title]),
    el('div', { class: 'finding-detail' }, [f.detail]),
  ]);
}

// ── Suppliers / Agencies leaderboards ───────────────────────────────────────

export function renderSuppliers(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Supplier leaderboard', `The 300 largest suppliers to the Commonwealth in ${a.meta.fyLabel}, ranked by total contract value. Click any supplier to drill in.`, 'supplier'));

  const search = el('input', { class: 'inline-search', type: 'search', placeholder: 'Filter suppliers…', 'aria-label': 'Filter suppliers' });
  wrap.append(el('div', { class: 'inline-controls' }, [search]));

  const tableWrap = el('div', { class: 'lead-table-wrap' });
  wrap.append(tableWrap);

  const draw = (q: string) => {
    clear(tableWrap);
    const rows = a.topSuppliers.filter((s) => !q || s.name.toLowerCase().includes(q));
    const table = el('table', { class: 'lead-table' });
    table.append(el('thead', {}, [el('tr', {}, [
      el('th', { class: 'c-rank' }, ['#']),
      el('th', {}, ['Supplier']),
      el('th', { class: 'c-num' }, ['Total value']),
      el('th', { class: 'c-num' }, ['Contracts']),
      el('th', { class: 'c-num' }, ['Avg']),
      el('th', { class: 'c-num' }, ['Agencies']),
      el('th', { class: 'c-num' }, [labelWithInfo('Limited %', 'per-limited')]),
      el('th', {}, ['Top category']),
    ])]));
    const tbody = el('tbody');
    const maxV = rows.length ? rows[0].value : 1;
    rows.forEach((s, i) => {
      const bar = el('div', { class: 'cell-bar' });
      bar.style.width = `${(s.value / maxV) * 100}%`;
      bar.style.background = segColor(s.topSeg || '00');
      tbody.append(el('tr', {}, [
        el('td', { class: 'c-rank' }, [String(i + 1)]),
        el('td', {}, [entityLink(ctx, 'supplier', s.name)]),
        el('td', { class: 'c-num c-val' }, [el('div', { class: 'val-cell' }, [bar, el('span', {}, [moneyFull(s.value)])])]),
        el('td', { class: 'c-num' }, [num(s.count)]),
        el('td', { class: 'c-num' }, [money(s.avg)]),
        el('td', { class: 'c-num' }, [String(s.agencies)]),
        el('td', { class: 'c-num' + (s.limitedPct >= 60 ? ' cell-warn' : '') }, [s.limitedPct + '%']),
        el('td', { class: 'c-cat' }, [ctx.segName.get(s.topSeg || '') || '—']),
      ]));
    });
    table.append(tbody);
    if (!rows.length) tableWrap.append(el('div', { class: 'empty' }, ['No suppliers match your filter.']));
    else tableWrap.append(table);
  };
  draw('');
  search.addEventListener('input', debounce(() => draw(search.value.trim().toLowerCase()), 200));
  return wrap;
}

export function renderAgencies(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Agency leaderboard', `All ${a.topAgencies.length} Commonwealth agencies that reported contracts in ${a.meta.fyLabel}, ranked by spend. Click an agency to drill in.`, 'procuring-entity'));

  const search = el('input', { class: 'inline-search', type: 'search', placeholder: 'Filter agencies…', 'aria-label': 'Filter agencies' });
  wrap.append(el('div', { class: 'inline-controls' }, [search]));
  const tableWrap = el('div', { class: 'lead-table-wrap' });
  wrap.append(tableWrap);

  const draw = (q: string) => {
    clear(tableWrap);
    const rows = a.topAgencies.filter((s) => !q || s.name.toLowerCase().includes(q));
    const table = el('table', { class: 'lead-table' });
    table.append(el('thead', {}, [el('tr', {}, [
      el('th', { class: 'c-rank' }, ['#']),
      el('th', {}, ['Agency']),
      el('th', { class: 'c-num' }, ['Total spend']),
      el('th', { class: 'c-num' }, ['Contracts']),
      el('th', { class: 'c-num' }, ['Avg']),
      el('th', { class: 'c-num' }, ['Suppliers']),
      el('th', { class: 'c-num' }, [labelWithInfo('Limited %', 'per-limited')]),
      el('th', {}, ['Top category']),
    ])]));
    const tbody = el('tbody');
    const maxV = rows.length ? Math.max(...rows.map((r) => r.value)) : 1;
    rows.forEach((s, i) => {
      const bar = el('div', { class: 'cell-bar' });
      bar.style.width = `${(s.value / maxV) * 100}%`;
      bar.style.background = 'var(--navy)';
      tbody.append(el('tr', {}, [
        el('td', { class: 'c-rank' }, [String(i + 1)]),
        el('td', {}, [entityLink(ctx, 'agency', s.name)]),
        el('td', { class: 'c-num c-val' }, [el('div', { class: 'val-cell' }, [bar, el('span', {}, [moneyFull(s.value)])])]),
        el('td', { class: 'c-num' }, [num(s.count)]),
        el('td', { class: 'c-num' }, [money(s.avg)]),
        el('td', { class: 'c-num' }, [num(s.suppliers)]),
        el('td', { class: 'c-num' + (s.limitedPct >= 60 ? ' cell-warn' : '') }, [s.limitedPct + '%']),
        el('td', { class: 'c-cat' }, [ctx.segName.get(s.topSeg || '') || '—']),
      ]));
    });
    table.append(tbody);
    if (!rows.length) tableWrap.append(el('div', { class: 'empty' }, ['No agencies match your filter.']));
    else tableWrap.append(table);
  };
  draw('');
  search.addEventListener('input', debounce(() => draw(search.value.trim().toLowerCase()), 200));
  return wrap;
}

// ── Categories (treemap) ────────────────────────────────────────────────────

export function renderCategories(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Spending by category', 'Every contract classified by the top level of the international UNSPSC standard. Rectangle size = total value.', 'unspsc'));
  const total = a.categories.reduce((s, c) => s + c.value, 0);
  const nodes = a.categories.map((c) => ({
    label: c.name, value: c.value, color: segColor(c.seg),
    sub: `${num(c.count)} contracts`,
  }));
  const tmWrap = el('div', { class: 'treemap-container' });
  tmWrap.append(treemap(nodes, 1000, 460));
  wrap.append(tmWrap);

  // Ranked list beneath
  wrap.append(horizontalBars(
    a.categories.map((c) => ({
      label: c.name, value: c.value, color: segColor(c.seg),
      meta: `${num(c.count)} contracts · ${pct(c.value, total)} of all value`,
    }))
  ));
  return wrap;
}

// ── Contracts (searchable virtual table) ────────────────────────────────────

const ROW_H = 40;

export function renderContracts(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view view-contracts' });
  const capNote = a.meta.tableIsCapped
    ? `Showing the ${num(a.meta.tableCount)} largest contracts — every contract at or above ${moneyFull(a.meta.tableMinAmount)}. Aggregate views above cover all ${num(a.meta.count)} contracts.`
    : `All ${num(a.meta.tableCount)} contracts.`;
  wrap.append(panel('Contract database', capNote, 'contract-notice'));

  const controls = el('div', { class: 'table-controls' });
  const search = el('input', { class: 'inline-search wide', type: 'search', placeholder: 'Search supplier, agency or description…', 'aria-label': 'Search contracts' });
  const segSel = el('select', { class: 'sel', 'aria-label': 'Filter by category' }, [el('option', { value: '' }, ['All categories'])]);
  a.categories.forEach((c) => segSel.append(el('option', { value: c.seg }, [c.name])));
  const methodSel = el('select', { class: 'sel', 'aria-label': 'Filter by procurement method' }, [el('option', { value: '-1' }, ['All methods'])]);
  a.meta.methods.forEach((mLabel, i) => methodSel.append(el('option', { value: String(i) }, [mLabel])));
  const stateSel = el('select', { class: 'sel', 'aria-label': 'Filter by supplier state' }, [el('option', { value: '-1' }, ['All states'])]);
  a.meta.states.forEach((s, i) => stateSel.append(el('option', { value: String(i) }, [s])));
  const sortSel = el('select', { class: 'sel', 'aria-label': 'Sort order' }, [
    el('option', { value: 'value' }, ['Sort: value']),
    el('option', { value: 'date' }, ['Sort: newest']),
  ]);
  controls.append(search, segSel, methodSel, stateSel, sortSel);
  wrap.append(controls);

  const countLine = el('div', { class: 'result-count' }, ['Loading contracts…']);
  wrap.append(countLine);

  const header = el('div', { class: 'ctable-head' }, [
    el('div', { class: 'ct-supplier' }, ['Supplier']),
    el('div', { class: 'ct-agency' }, ['Agency']),
    el('div', { class: 'ct-cat' }, ['Category']),
    el('div', { class: 'ct-method' }, ['Method']),
    el('div', { class: 'ct-date' }, ['Date']),
    el('div', { class: 'ct-value' }, ['Value']),
  ]);
  wrap.append(header);

  const scroller = el('div', { class: 'ctable-scroll' });
  const spacer = el('div', { class: 'ctable-spacer' });
  const viewport = el('div', { class: 'ctable-viewport' });
  spacer.append(viewport);
  scroller.append(spacer);
  wrap.append(scroller);

  let table: ContractTable | null = null;
  let rows: TableRow[] = [];
  const filters: TableFilters = { search: '', seg: '', method: -1, state: -1, sort: 'value' };

  const renderWindow = () => {
    if (!table) return;
    const scrollTop = scroller.scrollTop;
    const vh = scroller.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 6);
    const end = Math.min(rows.length, Math.ceil((scrollTop + vh) / ROW_H) + 6);
    clear(viewport);
    viewport.style.transform = `translateY(${start * ROW_H}px)`;
    for (let i = start; i < end; i++) {
      const r = rows[i];
      const row = el('div', { class: 'ctable-row' });
      row.append(
        el('div', { class: 'ct-supplier' }, [entityLink(ctx, 'supplier', table.suppliers[r[SUP]])]),
        el('div', { class: 'ct-agency', title: table.agencies[r[AG]] }, [entityLink(ctx, 'agency', table.agencies[r[AG]])]),
        el('div', { class: 'ct-cat' }, [
          el('span', { class: 'cat-pill', title: ctx.segName.get(r[SEG]) || '' }, [ctx.segName.get(r[SEG]) || '—']),
        ]),
        el('div', { class: 'ct-method' }, [
          el('span', { class: 'method-pill', style: `background:${MC[r[METHOD]] || MC[3]}` }, [a.meta.methods[r[METHOD]].replace(' tender', '')]),
        ]),
        el('div', { class: 'ct-date' }, [prettyDate(r[DATE])]),
        el('div', { class: 'ct-value' }, [moneyFull(r[AMT])]),
      );
      (row.querySelector('.cat-pill') as HTMLElement).style.color = segColor(r[SEG] || '00');
      const desc = r[DESC];
      if (desc) row.title = desc;
      viewport.append(row);
    }
  };

  const applyFilters = () => {
    if (!table) return;
    rows = filterTable(table, filters);
    spacer.style.height = `${rows.length * ROW_H}px`;
    countLine.textContent = `${num(rows.length)} ${rows.length === 1 ? 'contract' : 'contracts'}`;
    scroller.scrollTop = 0;
    renderWindow();
  };

  scroller.addEventListener('scroll', renderWindow);
  search.addEventListener('input', debounce(() => { filters.search = search.value; applyFilters(); }, 250));
  segSel.addEventListener('change', () => { filters.seg = (segSel as HTMLSelectElement).value; applyFilters(); });
  methodSel.addEventListener('change', () => { filters.method = parseInt((methodSel as HTMLSelectElement).value, 10); applyFilters(); });
  stateSel.addEventListener('change', () => { filters.state = parseInt((stateSel as HTMLSelectElement).value, 10); applyFilters(); });
  sortSel.addEventListener('change', () => { filters.sort = (sortSel as HTMLSelectElement).value as 'value' | 'date'; applyFilters(); });

  ctx.getTable().then((t) => {
    table = t;
    applyFilters();
  }).catch(() => {
    countLine.textContent = 'Failed to load contract data. Please refresh.';
    countLine.classList.add('error');
  });

  return wrap;
}

// ── Network ─────────────────────────────────────────────────────────────────

export function renderNetwork(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Supplier ↔ agency network', 'How the biggest suppliers connect to the agencies that pay them. Circle size = total value; agencies are navy, suppliers coloured by their main category. Hover a node to trace its links; scroll to zoom, drag to pan.'));
  wrap.append(legend([
    { color: 'var(--navy)', label: 'Government agency' },
    { color: 'var(--accent)', label: 'Supplier (colour = category)' },
  ]));
  const box = el('div', { class: 'network-box' });
  const net = forceNetwork(a.network.nodes, a.network.links, 1000, 620);
  box.append(net);
  wrap.append(box);
  attachSvgZoom(net as SVGSVGElement);
  wrap.append(el('p', { class: 'view-note' }, [
    `Showing the ${a.network.nodes.length} most-connected entities and their ${a.network.links.length} strongest funding relationships.`,
  ]));
  return wrap;
}

// ── Flow (Sankey) ───────────────────────────────────────────────────────────

export function renderFlow(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Where the money flows', 'Contract value flowing from the biggest-spending agencies (left) to procurement categories (right). Ribbon width = dollars.', 'unspsc'));
  const box = el('div', { class: 'flow-box' });
  const catColor = (i: number) => {
    const seg = catSegForName(a, a.flow.categories[i]);
    return seg ? segColor(seg) : 'var(--accent)';
  };
  box.append(sankey(
    { left: a.flow.agencies, right: a.flow.categories, links: a.flow.links, leftColor: () => 'var(--navy)', rightColor: catColor },
    1000, 620
  ));
  wrap.append(box);
  return wrap;
}

function catSegForName(a: Aggregates, name: string): string | null {
  const found = a.categories.find((c) => c.name === name);
  return found ? found.seg : null;
}

// ── Matrix ──────────────────────────────────────────────────────────────────

export function renderMatrix(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Agency × category matrix', 'Where each top agency concentrates its spend. Darker cells = more dollars. Reveals which agencies dominate which categories.', 'unspsc'));
  const rowLabels = a.matrix.agencies.map((ag) => ({ name: ag.name, onClick: () => ctx.openEntity('agency', ag.name) }));
  wrap.append(heatmap(rowLabels, a.matrix.categories, a.matrix.grid, 1100));
  return wrap;
}

// ── Map ─────────────────────────────────────────────────────────────────────

export function renderMapView(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Supplier value by state', 'Total contract value awarded to suppliers based in each state or territory. Based on the supplier’s registered address.'));
  const mapWrap = el('div', { class: 'map-wrap' });
  wrap.append(mapWrap);
  renderMap(mapWrap, a.states).catch(() => {
    mapWrap.append(el('div', { class: 'error' }, ['Could not load the map. The state totals are still available in the Insights view.']));
  });
  return wrap;
}

// ── Trends ──────────────────────────────────────────────────────────────────

export function renderTrends(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Monthly spending trend', `Committed contract value by month across ${a.meta.fyLabel}. Watch for the June end-of-financial-year spike.`));
  wrap.append(columns(a.monthly.map((mo) => ({ label: prettyMonth(mo.ym), value: mo.value, sub: `${num(mo.count)} contracts` })), 300));

  wrap.append(panel('Method by month', 'Split of open vs limited tender value over time.'));
  wrap.append(legend(a.methods.map((mth) => ({ color: MC[mth.code] || MC[3], label: mth.label }))));
  // stacked-ish: show method totals as bars
  wrap.append(horizontalBars(
    a.methods.slice().sort((x, y) => y.value - x.value).map((mth) => ({
      label: mth.label, value: mth.value, color: MC[mth.code] || MC[3],
      meta: `${num(mth.count)} contracts · ${pct(mth.value, a.meta.totalValue)} of value`,
    }))
  ));
  return wrap;
}

// ── Insights ────────────────────────────────────────────────────────────────

export function renderInsights(ctx: AppContext): HTMLElement {
  const a = ctx.agg;
  const wrap = el('div', { class: 'view' });
  wrap.append(panel('Insights & anomalies', 'Automatically detected patterns worth a closer look.'));
  const cards = el('div', { class: 'findings-grid' });
  a.findings.forEach((f) => cards.append(findingCard(f)));
  wrap.append(cards);

  wrap.append(panel('Distribution of contract values', 'How many contracts fall into each value band. Most contracts are modest; a handful of mega-deals dominate the totals.', 'contract-value'));
  const maxCount = Math.max(...a.histogram.map((h) => h.count));
  const hist = el('div', { class: 'histogram' });
  a.histogram.forEach((h) => {
    const bar = el('div', { class: 'histo-bar-wrap' });
    const b = el('div', { class: 'histo-bar' });
    b.style.height = `${(h.count / maxCount) * 100}%`;
    b.addEventListener('mousemove', (e) =>
      showTip(`<strong>${h.label}</strong><br>${num(h.count)} contracts<br>${moneyFull(h.value)} total`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
    b.addEventListener('mouseleave', hideTip);
    bar.append(el('div', { class: 'histo-count' }, [num(h.count)]), b, el('div', { class: 'histo-label' }, [h.label]));
    hist.append(bar);
  });
  wrap.append(hist);
  return wrap;
}

// ── Entity drill-down drawer (drill-down) ────────────────────────────────────────────────

export async function buildEntityDrawer(
  ctx: AppContext,
  kind: 'supplier' | 'agency',
  name: string
): Promise<HTMLElement> {
  const a = ctx.agg;
  const body = el('div', { class: 'drawer-body' });

  const lead = kind === 'supplier'
    ? a.topSuppliers.find((s) => s.name === name)
    : a.topAgencies.find((s) => s.name === name);

  body.append(el('div', { class: 'drawer-kind' }, [kind === 'supplier' ? 'Supplier' : 'Government agency']));
  body.append(el('h2', { class: 'drawer-name' }, [name]));

  if (lead) {
    const rank = (kind === 'supplier' ? a.topSuppliers : a.topAgencies).findIndex((s) => s.name === name) + 1;
    const grid = el('div', { class: 'drawer-stats' }, [
      statCard(moneyFull(lead.value), kind === 'supplier' ? 'Total won' : 'Total spend'),
      statCard(num(lead.count), 'Contracts'),
      statCard(money(lead.avg), 'Average'),
      statCard('#' + rank, kind === 'supplier' ? 'Supplier rank' : 'Agency rank'),
      kind === 'supplier'
        ? statCard(String((lead as typeof a.topSuppliers[0]).agencies), 'Agencies')
        : statCard(num((lead as typeof a.topAgencies[0]).suppliers), 'Suppliers'),
      statCard(lead.limitedPct + '%', labelWithInfo('Limited tender', 'limited-tender'), lead.limitedPct >= 60 ? 'warn' : ''),
    ]);
    body.append(grid);
    if (lead.topSeg) {
      body.append(el('p', { class: 'drawer-cat' }, [
        'Main category: ', el('strong', {}, [ctx.segName.get(lead.topSeg) || lead.topSeg]),
      ]));
    }
  } else {
    body.append(el('p', { class: 'drawer-note' }, ['This entity is outside the top-ranked list; showing its largest contracts below.']));
  }

  body.append(el('h3', { class: 'drawer-sub' }, ['Largest contracts']));
  const list = el('div', { class: 'drawer-contracts' }, [el('div', { class: 'loading-mini' }, ['Loading contracts…'])]);
  body.append(list);

  ctx.getTable().then((t) => {
    clear(list);
    const col = kind === 'supplier' ? SUP : AG;
    const dict = kind === 'supplier' ? t.suppliers : t.agencies;
    const idx = dict.indexOf(name);
    let matches: TableRow[] = [];
    if (idx >= 0) matches = t.rows.filter((r) => r[col] === idx);
    matches.sort((x, y) => y[AMT] - x[AMT]);
    if (!matches.length) {
      list.append(el('div', { class: 'drawer-note' }, [
        lead ? 'This entity’s contracts are all below the table’s inclusion threshold, so individual rows aren’t listed here — but its totals above cover every contract.' : 'No individual contracts found in the table subset.',
      ]));
      return;
    }
    matches.slice(0, 40).forEach((r) => {
      const other = kind === 'supplier' ? t.agencies[r[AG]] : t.suppliers[r[SUP]];
      list.append(el('div', { class: 'drawer-contract' }, [
        el('div', { class: 'dc-top' }, [
          el('span', { class: 'dc-value' }, [moneyFull(r[AMT])]),
          el('span', { class: 'dc-date' }, [prettyDate(r[DATE])]),
        ]),
        el('div', { class: 'dc-other' }, [kind === 'supplier' ? '← ' : '→ ', entityLink(ctx, kind === 'supplier' ? 'agency' : 'supplier', other)]),
        el('div', { class: 'dc-desc' }, [r[DESC] || ctx.segName.get(r[SEG]) || '—']),
      ]));
    });
    if (matches.length > 40) list.append(el('div', { class: 'drawer-note' }, [`+ ${num(matches.length - 40)} more contracts in the table view.`]));
  }).catch(() => {
    clear(list);
    list.append(el('div', { class: 'error' }, ['Could not load contracts.']));
  });

  return body;
}
