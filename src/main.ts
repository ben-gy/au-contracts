import './style.css';
import { loadAggregates, loadTable, segNameMap } from './store.ts';
import { openAbout } from './ui.ts';
import { hideTip } from './charts.ts';
import { relativeTime } from './format.ts';
import type { Aggregates, ContractTable } from './types.ts';
import { el, clear } from './dom.ts';
import {
  type AppContext, type ViewKey,
  renderOverview, renderSuppliers, renderAgencies, renderCategories, renderContracts,
  renderNetwork, renderFlow, renderMatrix, renderMapView, renderTrends, renderInsights,
  buildEntityDrawer,
} from './views.ts';

const TABS: { key: ViewKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'agencies', label: 'Agencies' },
  { key: 'categories', label: 'Categories' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'network', label: 'Network' },
  { key: 'flow', label: 'Flow' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'map', label: 'Map' },
  { key: 'trends', label: 'Trends' },
  { key: 'insights', label: 'Insights' },
];

const RENDERERS: Record<ViewKey, (ctx: AppContext) => HTMLElement> = {
  overview: renderOverview,
  suppliers: renderSuppliers,
  agencies: renderAgencies,
  categories: renderCategories,
  contracts: renderContracts,
  network: renderNetwork,
  flow: renderFlow,
  matrix: renderMatrix,
  map: renderMapView,
  trends: renderTrends,
  insights: renderInsights,
};

class App {
  private agg!: Aggregates;
  private ctx!: AppContext;
  private tablePromise: Promise<ContractTable> | null = null;
  private current: ViewKey = 'overview';
  private main!: HTMLElement;
  private tabsEl!: HTMLElement;
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    this.renderShell();
    try {
      this.agg = await loadAggregates();
    } catch {
      this.showFatal();
      return;
    }
    this.ctx = {
      agg: this.agg,
      segName: segNameMap(this.agg.segNames),
      getTable: () => this.getTable(),
      navigate: (v) => this.navigate(v),
      openEntity: (kind, name) => this.openEntity(kind, name),
    };
    this.buildHeaderMeta();
    this.buildTabs();
    const initial = (location.hash.replace('#', '') as ViewKey);
    this.navigate(TABS.some((t) => t.key === initial) ? initial : 'overview');
  }

  private getTable(): Promise<ContractTable> {
    if (!this.tablePromise) this.tablePromise = loadTable();
    return this.tablePromise;
  }

  private renderShell(): void {
    clear(this.root);
    this.root.append(
      el('header', { class: 'site-header' }, [
        el('div', { class: 'brand' }, [
          el('span', { class: 'brand-mark' }, ['◆']),
          el('div', {}, [
            el('div', { class: 'brand-title' }, ['Government Contracts ', el('span', { class: 'brand-cc' }, ['(AU)'])]),
            el('div', { class: 'brand-meta', id: 'brand-meta' }, ['Loading…']),
          ]),
        ]),
        el('button', { class: 'about-btn', id: 'about-btn', 'aria-label': 'About this site' }, ['?']),
      ]),
      el('nav', { class: 'tabs', id: 'tabs', 'aria-label': 'Views' }),
    );
    const content = el('main', { class: 'main-content', id: 'main' });
    this.root.append(content);
    this.root.append(this.footer());
    this.main = content;
    this.tabsEl = this.root.querySelector('#tabs') as HTMLElement;
  }

  private buildHeaderMeta(): void {
    const meta = this.root.querySelector('#brand-meta') as HTMLElement;
    meta.textContent = `${this.agg.meta.fyLabel} · updated ${relativeTime(this.agg.meta.generated)}`;
    const btn = this.root.querySelector('#about-btn') as HTMLElement;
    btn.addEventListener('click', () => openAbout(this.agg.meta));
  }

  private buildTabs(): void {
    clear(this.tabsEl);
    TABS.forEach((t) => {
      const b = el('button', {
        class: 'tab' + (t.key === this.current ? ' active' : ''),
        'data-key': t.key,
        onclick: () => this.navigate(t.key),
      }, [t.label]);
      this.tabsEl.append(b);
    });
  }

  private navigate(view: ViewKey): void {
    this.current = view;
    hideTip();
    history.replaceState(null, '', `#${view}`);
    this.tabsEl.querySelectorAll('.tab').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.key === view);
    });
    clear(this.main);
    const rendered = RENDERERS[view](this.ctx);
    this.main.append(rendered);
    this.main.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  private async openEntity(kind: 'supplier' | 'agency', name: string): Promise<void> {
    const overlay = el('div', { class: 'drawer-overlay' });
    const drawer = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': name });
    const close = () => { overlay.remove(); drawer.classList.remove('open'); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    drawer.append(el('button', { class: 'drawer-close', 'aria-label': 'Close', onclick: close }, ['×']));
    const bodyHolder = el('div', { class: 'drawer-holder' }, [el('div', { class: 'loading-mini' }, ['Loading…'])]);
    drawer.append(bodyHolder);
    document.body.append(overlay, drawer);
    requestAnimationFrame(() => drawer.classList.add('open'));
    try {
      const body = await buildEntityDrawer(this.ctx, kind, name);
      clear(bodyHolder);
      bodyHolder.append(body);
    } catch {
      clear(bodyHolder);
      bodyHolder.append(el('div', { class: 'error' }, ['Could not load details.']));
    }
  }

  private showFatal(): void {
    clear(this.main);
    this.main.append(el('div', { class: 'fatal' }, [
      el('h2', {}, ['Data unavailable']),
      el('p', {}, ['The contract dataset could not be loaded. This is usually temporary — please refresh in a moment.']),
      el('button', { class: 'retry-btn', onclick: () => location.reload() }, ['Retry']),
    ]));
    const meta = this.root.querySelector('#brand-meta') as HTMLElement;
    if (meta) meta.textContent = 'Data unavailable';
  }

  private footer(): HTMLElement {
    return el('footer', { class: 'site-footer' }, [
      el('div', { class: 'footer-inner' }, [
        el('div', {}, [
          'Data: Australian Government contract notices via the AusTender Open Contracting (OCDS) API. ',
          'An independent transparency tool, not affiliated with the Commonwealth.',
        ]),
        el('div', { class: 'footer-attr' }, [
          'Built by ', el('a', { href: 'https://benrichardson.dev/', target: '_blank', rel: 'noopener' }, ['benrichardson.dev']),
          ' · ', el('a', { href: 'https://sites.benrichardson.dev', target: '_blank', rel: 'noopener' }, ['more tools & sites']),
        ]),
      ]),
    ]);
  }
}

const root = document.getElementById('app');
if (root) new App(root).start();
