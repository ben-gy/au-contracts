import type { Dataset, Supplier, Agency, Contract } from './types';
import { el, clear, debounce } from './dom';
import { money, moneyFull, num, pct, dateLabel } from './format';
import { segColor } from './colors';
import { gloss, infoDot } from './tooltip';
import { hbars, monthlyChart, treemap, matrixHeatmap, sankey, network, legend } from './charts';
import { SEGMENTS } from './segments';
import { filterSuppliers, filterAgencies, filterContracts, sortBy, page, type SortDir } from './analysis';

export interface ViewCtx {
  data: Dataset;
  search: string;
  openSupplier(slug: string, name?: string): void;
  openAgency(slug: string): void;
  setTab(id: string): void;
}

const PAGE_SIZE = 50;

function viewHead(title: string, desc: string): HTMLElement {
  return el('div', { class: 'view-head' }, [
    el('h2', {}, [title]),
    el('p', { html: desc }),
  ]);
}

function catPill(seg: string): HTMLElement {
  const p = el('span', { class: 'pill cat', title: SEGMENTS[seg] || 'Other' }, [SEGMENTS[seg] || 'Other']);
  p.style.background = segColor(seg);
  return p;
}

// ─────────────── Overview ───────────────
export function renderOverview(ctx: ViewCtx): HTMLElement {
  const { data } = ctx;
  const m = data.meta;
  const wrap = el('div', { class: 'grid' });

  wrap.append(viewHead(
    'Where Commonwealth money goes',
    `Every Australian Government ${gloss('Contract Notice', 'contract notice')} published to ${gloss('AusTender')} between <strong>${dateLabel(m.periodStart)}</strong> and <strong>${dateLabel(m.periodEnd)}</strong> — two full ${gloss('Financial year', 'financial years')} of federal procurement, aggregated and searchable.`,
  ));

  // hero stat cards
  const cards = el('div', { class: 'cards' });
  const mk = (v: string, l: string, sub: string, gold = false) => el('div', { class: 'stat-card' }, [
    el('div', { class: `v${gold ? ' gold' : ''}` }, [v]),
    el('div', { class: 'l' }, [l]),
    el('div', { class: 'sub' }, [sub]),
  ]);
  cards.append(
    mk(money(m.totalValue), 'Total contract value', `${num(m.totalContracts)} contracts`, true),
    mk(num(m.totalContracts), 'Contracts awarded', `across ${num(m.agencyCount)} agencies`),
    mk(num(m.supplierCount), 'Distinct suppliers', 'companies & individuals paid'),
    mk(`${pct(m.consultingShare, 0)}`, 'Professional & consulting', `${money(m.consultingTotal)} of spend`),
  );
  wrap.append(cards);

  // monthly trend
  const trend = el('div', { class: 'panel panel-pad' });
  trend.append(el('div', { class: 'section-title', html: `Monthly contract value ${infoDot('Contract value')}` }));
  trend.append(el('p', { class: 'subtle', html: 'Total value of contracts by the month they were signed. Watch for the June end-of-financial-year spike.' }));
  const vz = el('div', { class: 'viz' });
  vz.append(monthlyChart(data.monthly));
  trend.append(vz);
  wrap.append(trend);

  // two-col: top suppliers + top agencies
  const two = el('div', { class: 'two-col' });
  const sp = el('div', { class: 'panel panel-pad' });
  sp.append(el('div', { class: 'section-title' }, ['Top 10 suppliers']));
  sp.append(hbars(data.suppliers.slice(0, 10).map((s) => ({ label: s.name, value: s.total, color: segColor(s.cat), onClick: () => ctx.openSupplier(s.slug, s.name) }))));
  const ag = el('div', { class: 'panel panel-pad' });
  ag.append(el('div', { class: 'section-title' }, ['Top 10 buying agencies']));
  ag.append(hbars(data.agencies.slice(0, 10).map((a) => ({ label: a.name, value: a.total, color: 'var(--navy)', onClick: () => ctx.openAgency(a.slug) }))));
  two.append(sp, ag);
  wrap.append(two);

  // category treemap
  const tm = el('div', { class: 'panel panel-pad' });
  tm.append(el('div', { class: 'section-title', html: `Spend by category ${infoDot('UNSPSC')}` }));
  tm.append(el('p', { class: 'subtle' }, ['Whole-of-government spend split by procurement category. Click "Categories" for the full breakdown.']));
  const tmv = el('div', { class: 'viz' });
  tmv.append(treemap(data.categories.slice(0, 16).map((c) => ({ seg: c.seg, name: c.name, total: c.total }))));
  tm.append(tmv);
  wrap.append(tm);

  // insights preview
  const ins = el('div', { class: 'panel panel-pad' });
  ins.append(el('div', { class: 'section-title' }, ['Notable findings']));
  const insGrid = el('div', { class: 'grid' });
  for (const it of data.insights.slice(0, 3)) {
    insGrid.append(insightCard(it, ctx));
  }
  const more = el('button', { class: 'btn ghost' }, ['See all findings →']);
  more.onclick = () => ctx.setTab('insights');
  ins.append(insGrid, el('div', { style: 'margin-top:1rem' }, [more]));
  wrap.append(ins);

  return wrap;
}

function insightCard(it: Dataset['insights'][number], ctx: ViewCtx): HTMLElement {
  const icon = it.severity === 'warn' ? '⚠️' : it.severity === 'alert' ? '🚩' : '💡';
  const card = el('div', { class: `insight-card ${it.severity}` }, [
    el('div', { class: 'ic' }, [icon]),
    el('div', {}, [el('h4', {}, [it.title]), el('p', {}, [it.detail])]),
  ]);
  if (it.agency) { card.style.cursor = 'pointer'; card.onclick = () => ctx.openAgency(it.agency!); }
  else if (it.supplier) { card.style.cursor = 'pointer'; card.onclick = () => ctx.openSupplier(it.supplier!); }
  return card;
}

// ─────────────── Generic sortable table view ───────────────
interface Col<T> { key: keyof T; label: string; num?: boolean; render?: (row: T) => Node | string; term?: string; }

function tableView<T>(opts: {
  rows: T[];
  cols: Col<T>[];
  initialSort: keyof T;
  searchTerm: string;
  filterFn: (rows: T[], q: string) => T[];
  searchPlaceholder: string;
  extraControls?: (rerender: () => void) => HTMLElement[];
  rowFilter?: () => (row: T) => boolean;
}): HTMLElement {
  let sortKey = opts.initialSort;
  let sortDir: SortDir = 'desc';
  let q = opts.searchTerm;
  let pageIdx = 0;

  const wrap = el('div', {});
  const controls = el('div', { class: 'controls' });
  const search = el('input', { type: 'search', placeholder: opts.searchPlaceholder, 'aria-label': opts.searchPlaceholder }) as HTMLInputElement;
  search.value = q;
  const count = el('div', { class: 'count' });
  const tableWrap = el('div', { class: 'table-wrap' });

  function compute(): T[] {
    let list = opts.filterFn(opts.rows, q);
    if (opts.rowFilter) list = list.filter(opts.rowFilter());
    list = sortBy(list, sortKey, sortDir);
    return list;
  }

  function renderTable(): void {
    const list = compute();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (pageIdx >= totalPages) pageIdx = 0;
    const pageRows = page(list, pageIdx, PAGE_SIZE);
    count.textContent = `${num(list.length)} rows${list.length > PAGE_SIZE ? ` · page ${pageIdx + 1}/${totalPages}` : ''}`;
    clear(tableWrap);

    const table = el('table', { class: 'data' });
    const thead = el('thead');
    const htr = el('tr');
    htr.append(el('th', {}, ['#']));
    for (const c of opts.cols) {
      const th = el('th', { class: `sortable${c.num ? ' num' : ''}` });
      th.append(c.label);
      if (c.key === sortKey) th.append(el('span', { class: 'sort-ind' }, [sortDir === 'desc' ? ' ▼' : ' ▲']));
      th.onclick = () => {
        if (sortKey === c.key) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
        else { sortKey = c.key; sortDir = c.num ? 'desc' : 'asc'; }
        renderTable();
      };
      htr.append(th);
    }
    thead.append(htr);
    table.append(thead);

    const tbody = el('tbody');
    pageRows.forEach((row, i) => {
      const tr = el('tr');
      tr.append(el('td', { class: 'rank' }, [String(pageIdx * PAGE_SIZE + i + 1)]));
      for (const c of opts.cols) {
        const td = el('td', { class: c.num ? 'num' : '' });
        if (c.render) td.append(c.render(row));
        else td.append(String(row[c.key] ?? ''));
        tr.append(td);
      }
      tbody.append(tr);
    });
    table.append(tbody);
    tableWrap.append(table);

    // pager
    if (totalPages > 1) {
      const pager = el('div', { class: 'controls', style: 'margin-top:1rem;justify-content:center' });
      const prev = el('button', { class: 'btn ghost' }, ['← Prev']);
      const next = el('button', { class: 'btn ghost' }, ['Next →']);
      prev.onclick = () => { if (pageIdx > 0) { pageIdx--; renderTable(); } };
      next.onclick = () => { if (pageIdx < totalPages - 1) { pageIdx++; renderTable(); } };
      (prev as HTMLButtonElement).disabled = pageIdx === 0;
      (next as HTMLButtonElement).disabled = pageIdx === totalPages - 1;
      pager.append(prev, el('span', { class: 'subtle' }, [`Page ${pageIdx + 1} of ${totalPages}`]), next);
      tableWrap.append(pager);
    }
  }

  search.addEventListener('input', debounce(() => { q = search.value; pageIdx = 0; renderTable(); }, 250));
  controls.append(search);
  if (opts.extraControls) for (const c of opts.extraControls(() => { pageIdx = 0; renderTable(); })) controls.append(c);
  controls.append(count);
  wrap.append(controls, tableWrap);
  renderTable();
  return wrap;
}

// ─────────────── Suppliers ───────────────
export function renderSuppliers(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Suppliers', `Every company, individual or organisation paid under a Commonwealth ${gloss('Contract Notice', 'contract')}. Sort by value, count or average, or search by name, ${gloss('ABN')} or state. Click a supplier for a full breakdown.`));
  const cols: Col<Supplier>[] = [
    { key: 'name', label: 'Supplier', render: (s) => { const a = el('span', { class: 'linklike' }, [s.name]); a.onclick = () => ctx.openSupplier(s.slug, s.name); return a; } },
    { key: 'state', label: 'State', render: (s) => s.state || '—' },
    { key: 'cat', label: 'Top category', render: (s) => catPill(s.cat) },
    { key: 'total', label: 'Total won', num: true, render: (s) => moneyFull(s.total) },
    { key: 'count', label: 'Contracts', num: true, render: (s) => num(s.count) },
    { key: 'avg', label: 'Avg', num: true, render: (s) => money(s.avg) },
    { key: 'agencies', label: 'Agencies', num: true, render: (s) => num(s.agencies) },
  ];
  wrap.append(tableView({ rows: ctx.data.suppliers, cols, initialSort: 'total', searchTerm: ctx.search, filterFn: filterSuppliers, searchPlaceholder: 'Search suppliers, ABN, state…' }));
  return wrap;
}

// ─────────────── Agencies ───────────────
export function renderAgencies(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Buying agencies', `The government departments and agencies doing the buying — the ${gloss('Procuring entity', 'procuring entities')}. Click one for its category breakdown and top suppliers.`));
  const cols: Col<Agency>[] = [
    { key: 'name', label: 'Agency', render: (a) => { const x = el('span', { class: 'linklike' }, [a.name]); x.onclick = () => ctx.openAgency(a.slug); return x; } },
    { key: 'total', label: 'Total spend', num: true, render: (a) => moneyFull(a.total) },
    { key: 'count', label: 'Contracts', num: true, render: (a) => num(a.count) },
    { key: 'suppliers', label: 'Suppliers', num: true, render: (a) => num(a.suppliers) },
    { key: 'avg', label: 'Avg contract', num: true, render: (a) => money(a.avg) },
    { key: 'total', label: 'Top supplier', render: (a) => a.topSuppliers[0] ? `${a.topSuppliers[0].name.slice(0, 28)}` : '—' },
  ];
  wrap.append(tableView({ rows: ctx.data.agencies, cols, initialSort: 'total', searchTerm: ctx.search, filterFn: filterAgencies, searchPlaceholder: 'Search agencies…' }));
  return wrap;
}

// ─────────────── Categories ───────────────
export function renderCategories(ctx: ViewCtx): HTMLElement {
  const { data } = ctx;
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Categories', `Spend grouped by ${gloss('UNSPSC')} top-level category. Bars show total value; the table lists contract counts and the leading supplier in each.`));

  const barsPanel = el('div', { class: 'panel panel-pad' });
  barsPanel.append(el('div', { class: 'section-title' }, ['Total value by category']));
  barsPanel.append(hbars(data.categories.slice(0, 20).map((c) => ({ label: c.name, value: c.total, color: segColor(c.seg) }))));
  wrap.append(barsPanel);

  const tablePanel = el('div', { class: 'panel panel-pad' });
  const table = el('table', { class: 'data' });
  table.innerHTML = `<thead><tr><th>Category</th><th class="num">Total</th><th class="num">Contracts</th><th>Leading supplier</th><th>Type</th></tr></thead>`;
  const tb = el('tbody');
  for (const c of data.categories) {
    const tr = el('tr');
    const nameTd = el('td', {});
    nameTd.append(catPill(c.seg));
    const topSup = c.topSuppliers[0];
    tr.append(
      nameTd,
      el('td', { class: 'num' }, [moneyFull(c.total)]),
      el('td', { class: 'num' }, [num(c.count)]),
      el('td', {}, [topSup ? topSup.name.slice(0, 40) : '—']),
      el('td', {}, [c.consulting ? 'Professional/consulting' : 'Goods/other services']),
    );
    tb.append(tr);
  }
  table.append(tb);
  tablePanel.append(el('div', { class: 'table-wrap' }, [table]));
  wrap.append(tablePanel);
  return wrap;
}

// ─────────────── Consulting ───────────────
export function renderConsulting(ctx: ViewCtx): HTMLElement {
  const c = ctx.data.consulting;
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Professional &amp; consulting services', `Contracts for ${gloss('Consultancy', 'professional and consulting-type services')} — management and business advice, engineering and research, financial, legal, editorial and training. This groups the ${gloss('UNSPSC')} categories that typically cover such work; it is broader than AusTender's narrow "consultancy" flag.`));

  const cards = el('div', { class: 'cards' });
  const mk = (v: string, l: string, sub: string) => el('div', { class: 'stat-card' }, [el('div', { class: 'v gold' }, [v]), el('div', { class: 'l' }, [l]), el('div', { class: 'sub' }, [sub])]);
  cards.append(
    mk(money(c.total), 'Professional & consulting spend', `${pct(c.share, 1)} of all contract value`),
    mk(String(c.byFy.length), 'Financial years covered', c.byFy.map((f) => f.fy).join(' · ')),
    mk(money(c.bigFirms[0]?.total || 0), `Top firm: ${c.bigFirms[0]?.name || '—'}`, `${num(c.bigFirms[0]?.count || 0)} contracts`),
  );
  wrap.append(cards);

  const firmsPanel = el('div', { class: 'panel panel-pad' });
  firmsPanel.append(el('div', { class: 'section-title' }, ['Major firms — total government contract value']));
  firmsPanel.append(el('p', { class: 'subtle' }, ['Well-known consulting and IT-services firms, matched by name across all categories (not just consulting). Note PwC’s collapse following the 2023 tax-leaks scandal.']));
  firmsPanel.append(hbars(c.bigFirms.map((f) => ({ label: `${f.name} (${num(f.count)})`, value: f.total, color: segColor('80') }))));
  wrap.append(firmsPanel);

  const two = el('div', { class: 'two-col' });
  const fyPanel = el('div', { class: 'panel panel-pad' });
  fyPanel.append(el('div', { class: 'section-title' }, ['By financial year']));
  fyPanel.append(hbars(c.byFy.map((f) => ({ label: f.fy, value: f.total, color: 'var(--gold)' }))));
  two.append(fyPanel);

  const supPanel = el('div', { class: 'panel panel-pad' });
  supPanel.append(el('div', { class: 'section-title' }, ['Top suppliers in these categories']));
  supPanel.append(hbars(c.topSuppliers.slice(0, 12).map((s) => ({ label: s.name, value: s.total, color: segColor('81'), onClick: () => ctx.openSupplier(s.slug, s.name) }))));
  two.append(supPanel);
  wrap.append(two);
  return wrap;
}

// ─────────────── Biggest contracts ───────────────
export function renderBiggest(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Biggest contracts', `The 1,000 largest individual contracts by value. Search by title, supplier, agency or category; filter by ${gloss('Procurement method')}.`));
  let methodFilter = 'all';
  const cols: Col<Contract>[] = [
    { key: 'title', label: 'Contract', render: (c) => el('span', { title: c.title }, [c.title || '—']) },
    { key: 'supplier', label: 'Supplier', render: (c) => el('span', { class: 'linklike' }, [c.supplier.slice(0, 32)]) },
    { key: 'agency', label: 'Agency', render: (c) => c.agency.slice(0, 30) },
    { key: 'seg', label: 'Category', render: (c) => catPill(c.seg) },
    { key: 'signed', label: 'Signed', render: (c) => dateLabel(c.signed) },
    { key: 'amount', label: 'Value', num: true, render: (c) => moneyFull(c.amount) },
  ];
  const view = tableView({
    rows: ctx.data.largest,
    cols,
    initialSort: 'amount',
    searchTerm: ctx.search,
    filterFn: filterContracts,
    searchPlaceholder: 'Search contracts…',
    rowFilter: () => (c: Contract) => methodFilter === 'all' || (c.method || '').toLowerCase().includes(methodFilter),
    extraControls: (rerender) => {
      const sel = el('select', { 'aria-label': 'Filter by procurement method' }) as HTMLSelectElement;
      sel.innerHTML = `<option value="all">All methods</option><option value="open">Open tender</option><option value="limited">Limited tender</option><option value="prequal">Prequalified</option>`;
      sel.onchange = () => { methodFilter = sel.value; rerender(); };
      return [sel];
    },
  });
  // wire supplier links (delegation)
  view.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.classList.contains('linklike')) {
      const name = t.textContent || '';
      const match = ctx.data.suppliers.find((s) => s.name.startsWith(name.replace('…', '')));
      if (match) ctx.openSupplier(match.slug, match.name);
    }
  });
  wrap.append(view);
  return wrap;
}

// ─────────────── Network ───────────────
export function renderNetwork(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Supplier ↔ agency network', 'How the biggest suppliers connect to the biggest buying agencies. Circle size = total value; navy circles are agencies, coloured circles are suppliers (coloured by their main category). Thicker lines = more money. Click any node to drill in.'));
  const panel = el('div', { class: 'panel panel-pad' });
  const vz = el('div', { class: 'viz' });
  vz.append(network(ctx.data.network, (kind, name) => {
    if (kind === 'agency') { const a = ctx.data.agencies.find((x) => x.name === name); if (a) ctx.openAgency(a.slug); }
    else { const s = ctx.data.suppliers.find((x) => x.name === name); if (s) ctx.openSupplier(s.slug, s.name); }
  }));
  panel.append(vz);
  const segs = [...new Set(ctx.data.network.suppliers.map((s) => s.cat))];
  panel.append(legend([{ label: 'Agency', color: 'var(--navy)' }, ...segs.map((s) => ({ label: SEGMENTS[s] || 'Other', color: segColor(s) }))]));
  wrap.append(panel);
  return wrap;
}

// ─────────────── Flow ───────────────
export function renderFlow(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Category → agency flow', 'Where each category of spend lands. The left column is the top procurement categories; the right column is the top buying agencies. Ribbon width is proportional to dollars. Hover a ribbon for the exact figure.'));
  const panel = el('div', { class: 'panel panel-pad' });
  const vz = el('div', { class: 'viz' });
  vz.append(sankey(ctx.data.flows));
  panel.append(vz);
  wrap.append(panel);
  return wrap;
}

// ─────────────── Matrix ───────────────
export function renderMatrix(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Agency × category matrix', 'A heatmap of the top agencies (rows) against the top categories (columns). Darker cells mean more spending. It reveals at a glance which agencies concentrate their money in which categories. Hover any cell for the exact value.'));
  const panel = el('div', { class: 'panel panel-pad' });
  const vz = el('div', { class: 'viz' });
  vz.append(matrixHeatmap(ctx.data.matrix));
  panel.append(vz);
  wrap.append(panel);
  return wrap;
}

// ─────────────── Map ───────────────
export function renderMap(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Supplier location', 'Total contract value by the supplier’s registered state or territory. Note: a supplier’s head-office state is not necessarily where the work is delivered — many national firms are registered in the ACT or a capital city.'));
  const panel = el('div', { class: 'panel panel-pad' });
  const mapDiv = el('div', { id: 'map' });
  panel.append(mapDiv);
  // Also a bar fallback
  const bars = el('div', { style: 'margin-top:1.5rem' });
  bars.append(el('div', { class: 'section-title' }, ['By state / territory']));
  bars.append(hbars(ctx.data.meta.states.filter((s) => s.state).map((s) => ({ label: s.state, value: s.total, color: 'var(--accent-teal)' }))));
  panel.append(bars);
  wrap.append(panel);
  // Leaflet is initialised by main.ts after mount (needs DOM in document).
  return wrap;
}

// ─────────────── Insights ───────────────
export function renderInsights(ctx: ViewCtx): HTMLElement {
  const wrap = el('div', { class: 'grid' });
  wrap.append(viewHead('Findings', `Automatically detected patterns: agencies whose spending is concentrated in a single supplier, unusually large suppliers, and big year-on-year category shifts. These are computed signals, not allegations — always check the underlying ${gloss('Contract Notice', 'contract notices')}.`));
  const grid = el('div', { class: 'grid' });
  for (const it of ctx.data.insights) grid.append(insightCard(it, ctx));
  wrap.append(grid);
  return wrap;
}
