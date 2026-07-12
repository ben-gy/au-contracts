// Glossary tooltips + generic viz tooltip. One fixed-position element, positioned near the target.
import { GLOSSARY } from './glossary';
import { esc } from './format';

let tip: HTMLDivElement;

function ensureTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

export function hideTip(): void {
  if (tip) tip.style.display = 'none';
}

function positionTip(x: number, y: number): void {
  const t = ensureTip();
  const rect = t.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + rect.width > window.innerWidth - 8) left = x - rect.width - 14;
  if (top + rect.height > window.innerHeight - 8) top = y - rect.height - 14;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}

/** Show the glossary definition for a term near an anchor element. */
function showGlossary(term: string, anchor: DOMRect): void {
  const def = GLOSSARY[term];
  if (!def) return;
  const t = ensureTip();
  t.className = '';
  t.innerHTML = `<strong>${esc(term)}</strong>${esc(def)}`;
  t.style.display = 'block';
  positionTip(anchor.left, anchor.bottom);
}

/** Show an arbitrary HTML tooltip at a cursor position (for charts). */
export function showVizTip(html: string, x: number, y: number): void {
  const t = ensureTip();
  t.className = 'viz-tip';
  t.innerHTML = html;
  t.style.display = 'block';
  positionTip(x, y);
}

/** Wrap a term in a glossary-link span with an info dot. */
export function gloss(term: string, label?: string): string {
  const text = label || term;
  return `<span class="glossary-link" data-term="${esc(term)}">${esc(text)}</span>`;
}

/** Standalone info dot that shows a glossary definition. */
export function infoDot(term: string): string {
  return `<span class="info-dot" data-term="${esc(term)}" role="button" tabindex="0" aria-label="What is ${esc(term)}?">i</span>`;
}

/** Install global handlers for glossary links / info dots. Call once. */
export function initGlossary(): void {
  ensureTip();
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-term]') as HTMLElement | null;
    if (target) {
      e.stopPropagation();
      const term = target.getAttribute('data-term') || '';
      showGlossary(term, target.getBoundingClientRect());
      return;
    }
    // click elsewhere dismisses (unless clicking inside the tip)
    if (!(e.target as HTMLElement).closest('#tooltip')) hideTip();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).matches?.('.info-dot')) {
      e.preventDefault();
      const term = (e.target as HTMLElement).getAttribute('data-term') || '';
      showGlossary(term, (e.target as HTMLElement).getBoundingClientRect());
    }
  });
  window.addEventListener('scroll', hideTip, true);
}
