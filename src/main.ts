import './style.css';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Dataset } from './types';
import { loadDataset } from './data';
import { el, clear } from './dom';
import { money, moneyFull, num, dateLabel, esc } from './format';
import { segColor } from './colors';
import { initGlossary, gloss, infoDot } from './tooltip';
import { GLOSSARY } from './glossary';
import { hbars } from './charts';
import {
  renderOverview, renderSuppliers, renderAgencies, renderCategories, renderConsulting,
  renderBiggest, renderNetwork, renderFlow, renderMatrix, renderMap, renderInsights, type ViewCtx,
} from './views';

const TABS: { id: string; label: string; render: (ctx: ViewCtx) => HTMLElement }[] = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'suppliers', label: 'Suppliers', render: renderSuppliers },
  { id: 'agencies', label: 'Agencies', render: renderAgencies },
  { id: 'categories', label: 'Categories', render: renderCategories },
  { id: 'consulting', label: 'Consulting', render: renderConsulting },
  { id: 'biggest', label: 'Biggest', render: renderBiggest },
  { id: 'network', label: 'Network', render: renderNetwork },
  { id: 'flow', label: 'Flow', render: renderFlow },
  { id: 'matrix', label: 'Matrix', render: renderMatrix },
  { id: 'map', label: 'Map', render: renderMap },
  { id: 'insights', label: 'Findings', render: renderInsights },
];

const AU_STATE_CENTROIDS: Record<string, [number, number]> = {
  NSW: [-32.5, 147.0], VIC: [-36.8, 144.5], QLD: [-22.5, 144.0], WA: [-25.5, 122.0],
  SA: [-30.5, 135.5], TAS: [-42.0, 146.6], ACT: [-35.5, 149.1], NT: [-19.5, 133.5],
};

let data: Dataset;
let currentTab = 'overview';
let headerSearch = '';
let mapInstance: L.Map | null = null;

function app(): HTMLElement { return document.getElementById('app')!; }

function boot(): void {
  const root = app();
  clear(root);
  root.append(loadingShell());
  const controller = new AbortController();
  loadDataset(controller.signal)
    .then((d) => { data = d; render(); route(); })
    .catch((err) => showError(err));
}

function loadingShell(): HTMLElement {
  const wrap = el('div', { class: 'main-content' });
  wrap.append(el('div', { class: 'state-msg' }, ['Loading contract data…']));
  const sk = el('div', { class: 'cards' });
  for (let i = 0; i < 4; i++) { const c = el('div', { class: 'stat-card skeleton', style: 'height:96px' }); sk.append(c); }
  wrap.append(sk);
  return wrap;
}

function showError(err: unknown): void {
  const root = app();
  clear(root);
  const box = el('div', { class: 'main-content' }, [
    el('div', { class: 'error-box' }, [
      el('h3', {}, ['Could not load contract data']),
      el('p', {}, [String((err as Error)?.message || err)]),
    ]),
  ]);
  const retry = el('button', { class: 'btn' }, ['Retry']);
  retry.onclick = boot;
  box.querySelector('.error-box')!.append(retry);
  root.append(box);
}

function ctx(): ViewCtx {
  return {
    data,
    search: headerSearch,
    openSupplier: (slug, name) => openSupplierDrawer(slug, name),
    openAgency: (slug) => openAgencyDrawer(slug),
    setTab: (id) => selectTab(id),
  };
}

function render(): void {
  const root = app();
  clear(root);
  root.append(buildHeader(), buildTabs(), buildMain(), buildFooter());
}

function buildHeader(): HTMLElement {
  const m = data.meta;
  const header = el('header', { class: 'site-header' });
  const inner = el('div', { class: 'header-inner' });

  const top = el('div', { class: 'header-top' });
  const brand = el('div', { class: 'brand' });
  brand.innerHTML = `
    <svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="#0b3a63"/><path d="M32 10 L52 20 H12 Z" fill="#f2b807"/><rect x="12" y="20" width="40" height="4" fill="#f2b807"/><rect x="16" y="26" width="5" height="20" fill="#e8eef4"/><rect x="26" y="26" width="5" height="20" fill="#e8eef4"/><rect x="33" y="26" width="5" height="20" fill="#e8eef4"/><rect x="43" y="26" width="5" height="20" fill="#e8eef4"/><rect x="12" y="48" width="40" height="5" fill="#f2b807"/></svg>
    <div class="brand-text"><h1>Government Contracts <span style="opacity:.7">(AU)</span></h1><p>Follow the public money · AusTender procurement</p></div>`;
  top.append(brand);
  top.append(el('div', { class: 'header-spacer' }));

  const searchWrap = el('div', { class: 'header-search' });
  searchWrap.innerHTML = `<span class="sicon">🔍</span>`;
  const input = el('input', { type: 'search', placeholder: 'Search suppliers / agencies…', 'aria-label': 'Search suppliers and agencies' }) as HTMLInputElement;
  input.value = headerSearch;
  let t: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      headerSearch = input.value;
      if (!['suppliers', 'agencies', 'biggest'].includes(currentTab)) selectTab('suppliers');
      else renderMainOnly();
    }, 280);
  });
  searchWrap.append(input);
  top.append(searchWrap);

  const gBtn = el('button', { class: 'icon-btn', title: 'Glossary', 'aria-label': 'Glossary' }, ['📖']);
  gBtn.onclick = openGlossaryModal;
  const aBtn = el('button', { class: 'icon-btn', title: 'About this site', 'aria-label': 'About this site' }, ['?']);
  aBtn.onclick = openAboutModal;
  top.append(gBtn, aBtn);
  inner.append(top);

  const stats = el('div', { class: 'header-stats' });
  const hs = (v: string, l: string, gold = false) => `<div class="hstat"><span class="v${gold ? ' gold' : ''}">${v}</span><span class="l">${l}</span></div>`;
  stats.innerHTML =
    hs(money(m.totalValue), 'Total value', true) +
    hs(num(m.totalContracts), 'Contracts') +
    hs(num(m.supplierCount), 'Suppliers') +
    hs(num(m.agencyCount), 'Agencies') +
    hs(`${dateLabel(m.periodStart)} – ${dateLabel(m.periodEnd)}`, 'Period covered');
  inner.append(stats);

  header.append(inner);
  return header;
}

function buildTabs(): HTMLElement {
  const bar = el('nav', { class: 'tabbar', 'aria-label': 'Views' });
  const inner = el('div', { class: 'tabbar-inner' });
  for (const t of TABS) {
    const b = el('button', { class: `tab${t.id === currentTab ? ' active' : ''}`, role: 'tab', 'aria-selected': String(t.id === currentTab) }, [t.label]);
    b.onclick = () => selectTab(t.id);
    inner.append(b);
  }
  bar.append(inner);
  return bar;
}

function buildMain(): HTMLElement {
  const main = el('main', { class: 'main-content', id: 'main-content' });
  const tab = TABS.find((t) => t.id === currentTab)!;
  main.append(tab.render(ctx()));
  if (currentTab === 'map') queueMicrotask(initMap);
  return main;
}

function renderMainOnly(): void {
  const old = document.getElementById('main-content');
  if (!old) { render(); return; }
  const main = buildMain();
  old.replaceWith(main);
}

function selectTab(id: string): void {
  currentTab = id;
  if (mapInstance && id !== 'map') { mapInstance.remove(); mapInstance = null; }
  // update tab active states + main
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (location.hash.startsWith('#tab=') || !location.hash) history.replaceState(null, '', `#tab=${id}`);
}

function buildFooter(): HTMLElement {
  const f = el('footer', { class: 'site-footer' });
  f.innerHTML = `
    <div class="footer-inner">
      <div class="disclaimer">
        <p><strong>Government Contracts (AU)</strong> aggregates open procurement data published by the Australian Government on AusTender (tenders.gov.au) under CC BY 3.0 AU. Figures reflect reported contract values, which may differ from amounts ultimately paid. Amendments are de-duplicated to the latest version. This is an independent tool, not affiliated with the Australian Government.</p>
        <p style="margin-top:.5rem">Data covers ${dateLabel(data.meta.periodStart)} – ${dateLabel(data.meta.periodEnd)} · generated ${dateLabel(data.meta.generated)}.</p>
      </div>
      <div>
        <p>Built by <a href="https://benrichardson.dev/">benrichardson.dev</a></p>
        <p style="margin-top:.5rem"><a href="https://www.tenders.gov.au/">Source: AusTender</a></p>
      </div>
    </div>`;
  return f;
}

// ─────────────── Drawers (drill-down) ───────────────
function closeOverlays(): void {
  document.querySelectorAll('.drawer, .drawer-backdrop, .modal-backdrop').forEach((n) => n.remove());
}

function drawerShell(title: string, sub: string): { backdrop: HTMLElement; body: HTMLElement } {
  closeOverlays();
  const backdrop = el('div', { class: 'drawer-backdrop' });
  const drawer = el('div', { class: 'drawer', role: 'dialog', 'aria-label': title });
  const head = el('div', { class: 'drawer-head' });
  head.innerHTML = `<div><h3>${esc(title)}</h3><div class="sub">${esc(sub)}</div></div>`;
  const close = el('button', { class: 'close', 'aria-label': 'Close' }, ['✕']);
  close.onclick = () => { backdrop.remove(); drawer.remove(); if (location.hash.includes('supplier=') || location.hash.includes('agency=')) history.replaceState(null, '', `#tab=${currentTab}`); };
  head.append(close);
  const body = el('div', { class: 'drawer-body' });
  drawer.append(head, body);
  backdrop.onclick = () => close.click();
  document.body.append(backdrop, drawer);
  document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close.click(); document.removeEventListener('keydown', esc2); } });
  return { backdrop, body };
}

function statGrid(items: [string, string][]): HTMLElement {
  const g = el('div', { class: 'drawer-stats' });
  for (const [v, l] of items) g.append(el('div', { class: 's' }, [el('div', { class: 'v' }, [v]), el('div', { class: 'l' }, [l])]));
  return g;
}

function openSupplierDrawer(slug: string, name?: string): void {
  const summary = data.suppliers.find((s) => s.slug === slug);
  const detail = data.suppliersDetail[slug];
  const title = detail?.name || name || summary?.name || 'Supplier';
  const { body } = drawerShell(title, 'Supplier');
  history.replaceState(null, '', `#supplier=${slug}`);

  if (summary) {
    body.append(statGrid([
      [moneyFull(summary.total), 'Total won'],
      [num(summary.count), 'Contracts'],
      [money(summary.avg), 'Average'],
      [money(summary.max), 'Largest'],
      [summary.state || '—', 'State'],
      [num(summary.agencies), 'Agencies'],
    ]));
    if (summary.abn) body.append(el('p', { class: 'subtle' }, [`ABN ${summary.abn}`]));
  }
  if (detail) {
    if (detail.cats.length) {
      body.append(el('h4', {}, ['Spend by category']));
      body.append(hbars(detail.cats.slice(0, 8).map((c) => ({ label: c.name, value: c.total, color: segColor(c.seg) }))));
    }
    if (detail.agencies.length) {
      body.append(el('h4', {}, ['Top buying agencies']));
      body.append(hbars(detail.agencies.slice(0, 10).map((a) => ({ label: a.name, value: a.total, color: 'var(--navy)', onClick: () => { const ag = data.agencies.find((x) => x.name === a.name); if (ag) openAgencyDrawer(ag.slug); } }))));
    }
  } else {
    body.append(el('p', { class: 'subtle', style: 'margin-top:1rem' }, ['Detailed category and agency breakdowns are pre-computed for the 400 largest suppliers. This supplier’s summary figures are shown above.']));
  }
}

function openAgencyDrawer(slug: string): void {
  const a = data.agencies.find((x) => x.slug === slug);
  if (!a) return;
  const { body } = drawerShell(a.name, 'Buying agency');
  history.replaceState(null, '', `#agency=${slug}`);
  body.append(statGrid([
    [moneyFull(a.total), 'Total spend'],
    [num(a.count), 'Contracts'],
    [money(a.avg), 'Avg contract'],
    [num(a.suppliers), 'Suppliers'],
  ]));
  if (a.cats.length) {
    body.append(el('h4', {}, ['Spend by category']));
    body.append(hbars(a.cats.slice(0, 8).map((c) => ({ label: c.name, value: c.total, color: segColor(c.seg) }))));
  }
  if (a.topSuppliers.length) {
    body.append(el('h4', {}, ['Top suppliers']));
    body.append(hbars(a.topSuppliers.slice(0, 10).map((s) => ({ label: s.name, value: s.total, color: 'var(--accent-primary)', onClick: () => { const sup = data.suppliers.find((x) => x.name === s.name); if (sup) openSupplierDrawer(sup.slug, sup.name); } }))));
  }
  if (a.methods.length) {
    body.append(el('h4', { html: `Procurement method ${infoDot('Procurement method')}` }));
    body.append(hbars(a.methods.map((mm) => ({ label: mm.name, value: mm.total, color: 'var(--accent-teal)' }))));
  }
}

// ─────────────── Modals ───────────────
function modalShell(title: string): HTMLElement {
  closeOverlays();
  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-label': title });
  const head = el('div', { class: 'modal-head' }, [el('h3', {}, [title])]);
  const close = el('button', { class: 'icon-btn', style: 'background:var(--bg-active);color:var(--text-primary)', 'aria-label': 'Close' }, ['✕']);
  close.onclick = () => backdrop.remove();
  head.append(close);
  const body = el('div', { class: 'modal-body' });
  modal.append(head, body);
  backdrop.append(modal);
  backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
  document.addEventListener('keydown', function esc3(e) { if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc3); } });
  document.body.append(backdrop);
  return body;
}

function openAboutModal(): void {
  const m = data.meta;
  const body = modalShell('About Government Contracts (AU)');
  body.innerHTML = `
    <h4>What is this?</h4>
    <p>An independent, searchable view of Australian Government procurement. It turns ${num(m.totalContracts)} raw ${gloss('Contract Notice', 'contract notices')} — worth ${money(m.totalValue)} — into leaderboards, category breakdowns and visual analysis, so you can quickly see which suppliers win the most, which agencies spend the most, and where the money for professional and consulting services goes.</p>
    <h4>Where does the data come from?</h4>
    <p>Everything is drawn from <a href="https://www.tenders.gov.au/">AusTender</a>, the Australian Government’s central procurement portal, via its open ${gloss('AusTender', 'Open Contracting')} data API. Most Commonwealth entities are legally required to publish contracts above the reporting threshold (generally $10,000). Data is licensed CC BY 3.0 AU.</p>
    <h4>How is it structured?</h4>
    <p>Each ${gloss('Contract Notice')} records the ${gloss('Supplier')}, the buying ${gloss('Procuring entity', 'agency')}, the ${gloss('Contract value', 'value')}, the ${gloss('UNSPSC')} category, the ${gloss('Procurement method')} and the contract dates. We aggregate by supplier, agency, category, month and ${gloss('Financial year')}. ${gloss('Amendment', 'Amendments')} are de-duplicated so each contract is counted once at its latest value.</p>
    <h4>How current is it?</h4>
    <p>This build covers <strong>${dateLabel(m.periodStart)} to ${dateLabel(m.periodEnd)}</strong> — the ${m.fyList.map((f) => f.fy).join(' and ')} financial years. A scheduled pipeline refreshes the underlying data; the current snapshot was generated on ${dateLabel(m.generated)}.</p>
    <h4>Important caveats</h4>
    <ul>
      <li>Reported contract <em>value</em> is the agreed amount, which may differ from what is ultimately spent.</li>
      <li>"Professional &amp; consulting services" here groups whole ${gloss('UNSPSC')} categories; it is broader than AusTender’s narrow "consultancy" flag, so totals will be higher than figures quoted using that flag.</li>
      <li>A supplier’s registered state is its head-office location, not necessarily where the work happens.</li>
      <li>The "Findings" are automatically computed signals to guide exploration — not accusations. Always check the underlying notices on AusTender.</li>
    </ul>`;
}

function openGlossaryModal(): void {
  const body = modalShell('Glossary');
  const dl = el('dl');
  for (const [term, def] of Object.entries(GLOSSARY)) {
    dl.append(el('dt', {}, [term]), el('dd', {}, [def]));
  }
  body.append(el('p', { class: 'subtle' }, ['Plain-language definitions for the procurement terms used across this site.']), dl);
}

// ─────────────── Leaflet map ───────────────
function initMap(): void {
  const div = document.getElementById('map');
  if (!div) return;
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  const map = L.map(div, { scrollWheelZoom: false, attributionControl: true }).setView([-27.5, 134], 4);
  mapInstance = map;
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 10,
  }).addTo(map);

  const states = data.meta.states.filter((s) => AU_STATE_CENTROIDS[s.state]);
  const max = Math.max(1, ...states.map((s) => s.total));
  for (const s of states) {
    const [lat, lng] = AU_STATE_CENTROIDS[s.state];
    const radius = 12 + 42 * Math.sqrt(s.total / max);
    const circle = L.circleMarker([lat, lng], {
      radius, color: '#0b3a63', weight: 1.5, fillColor: '#0f6fc6', fillOpacity: 0.55,
    }).addTo(map);
    circle.bindTooltip(`<strong>${s.state}</strong><br>${moneyFull(s.total)}<br>${num(s.count)} contracts`, { direction: 'top' });
    circle.bindPopup(`<strong>${s.state}</strong><br>${moneyFull(s.total)} across ${num(s.count)} contracts`);
  }
  const legend = new L.Control({ position: 'bottomright' });
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'map-legend');
    d.innerHTML = `<strong>Supplier state</strong><br>Circle size ∝ total contract value.<br>Hover a circle for detail.`;
    return d;
  };
  legend.addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

// ─────────────── Routing ───────────────
function route(): void {
  const h = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(h.includes('=') ? h : '');
  if (params.get('tab') && TABS.some((t) => t.id === params.get('tab'))) currentTab = params.get('tab')!;
  render();
  if (params.get('supplier')) openSupplierDrawer(params.get('supplier')!);
  else if (params.get('agency')) openAgencyDrawer(params.get('agency')!);
}

initGlossary();
boot();
