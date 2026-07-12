// Glossary tooltips + About modal + reusable info-icon helper.
import { GLOSSARY, lookup } from './glossary.ts';
import { el, clear } from './dom.ts';
import type { Meta } from './types.ts';
import { prettyDate, relativeTime, num } from './format.ts';

let tooltipEl: HTMLDivElement | null = null;

function ensureTooltip(): HTMLDivElement {
  if (tooltipEl) return tooltipEl;
  tooltipEl = el('div', { class: 'glossary-tooltip', role: 'tooltip', 'aria-hidden': 'true' }) as HTMLDivElement;
  document.body.append(tooltipEl);
  document.addEventListener('click', (e) => {
    if (!tooltipEl) return;
    const t = e.target as HTMLElement;
    if (!t.closest('.glossary-link') && !t.closest('.glossary-tooltip')) hideTooltip();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  });
  window.addEventListener('scroll', hideTooltip, true);
  return tooltipEl;
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }
}

function showTooltip(anchor: HTMLElement, key: string): void {
  const entry = lookup(key);
  if (!entry) return;
  const tip = ensureTooltip();
  clear(tip);
  tip.append(
    el('div', { class: 'glossary-tooltip-term' }, [entry.term]),
    el('div', { class: 'glossary-tooltip-def' }, [entry.definition])
  );
  tip.classList.add('visible');
  tip.setAttribute('aria-hidden', 'false');
  const r = anchor.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.bottom + 8;
  if (top + th > window.innerHeight - 8) top = r.top - th - 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/** An inline "ⓘ" info icon that reveals a glossary definition on click. */
export function infoIcon(key: string): HTMLElement {
  const span = el('span', {
    class: 'glossary-link',
    'data-term': key,
    role: 'button',
    tabindex: '0',
    'aria-label': `Definition of ${GLOSSARY[key]?.term ?? key}`,
    onclick: (e: Event) => {
      e.stopPropagation();
      showTooltip(e.currentTarget as HTMLElement, key);
    },
    onkeydown: (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        showTooltip(e.currentTarget as HTMLElement, key);
      }
    },
  }, ['ⓘ']);
  return span;
}

/** A label followed by its info icon. */
export function labelWithInfo(text: string, key: string): HTMLElement {
  return el('span', { class: 'label-info' }, [text, infoIcon(key)]);
}

// ── About modal ─────────────────────────────────────────────────────────────

export function openAbout(meta: Meta): void {
  const overlay = el('div', { class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'About this site' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });

  const body = el('div', { class: 'modal' }, [
    el('div', { class: 'modal-header' }, [
      el('h2', {}, ['About Government Contracts (AU)']),
      el('button', { class: 'modal-close', 'aria-label': 'Close', onclick: close }, ['×']),
    ]),
    el('div', { class: 'modal-body' }, [
      el('p', {}, [
        'Every year the Australian Government awards tens of thousands of contracts worth tens of billions of dollars. Agencies are required to publish each one as a ',
        'contract notice', ' on ', el('strong', {}, ['AusTender']),
        ', the Commonwealth’s procurement portal. This site takes that public record and turns it into leaderboards, a relationship map, a spend-flow diagram and a searchable database so you can see — at a glance — who wins government money and what for.',
      ]),
      el('h3', {}, ['Where the data comes from']),
      el('p', {}, [
        'Contracts are pulled directly from the live AusTender ',
        el('strong', {}, ['Open Contracting (OCDS) API']),
        `. This build covers the ${meta.fyLabel} financial year (${prettyDate(meta.windowFrom)} – ${prettyDate(meta.windowTo)}): `,
        el('strong', {}, [`${num(meta.count)} contracts`]),
        ` from ${num(meta.supplierCount)} suppliers across ${num(meta.agencyCount)} agencies.`,
      ]),
      el('h3', {}, ['How to read the numbers']),
      el('ul', {}, [
        el('li', {}, ['Values are the total committed contract value in AUD reported on AusTender, including published amendments. They are commitments, not necessarily amounts paid to date.']),
        el('li', {}, ['A contract awarded via ', el('strong', {}, ['limited tender']), ' skipped an open competitive process. A high limited-tender share can be legitimate, but is worth scrutiny.']),
        el('li', {}, ['Categories use the top level of the international ', el('strong', {}, ['UNSPSC']), ' classification.']),
      ]),
      el('h3', {}, ['Caveats']),
      el('ul', {}, [
        el('li', {}, [
          meta.tableIsCapped
            ? `The searchable table shows the ${num(meta.tableCount)} largest contracts (every contract at or above ${'$' + num(meta.tableMinAmount)}). All other views — leaderboards, categories, flow, matrix and insights — are computed across all ${num(meta.count)} contracts.`
            : `The searchable table shows all ${num(meta.tableCount)} contracts.`,
        ]),
        el('li', {}, ['Agencies occasionally amend or correct notices after publication; figures reflect the data as collected.']),
        el('li', {}, ['This is an independent tool and is not affiliated with the Australian Government or AusTender.']),
      ]),
      el('p', { class: 'modal-meta' }, [
        `Data collected ${relativeTime(meta.generated)} · Source: ${meta.source}`,
      ]),
    ]),
  ]);
  overlay.append(body);
  document.body.append(overlay);
  (overlay.querySelector('.modal-close') as HTMLElement)?.focus();
}
