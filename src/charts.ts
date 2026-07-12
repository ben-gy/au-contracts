// Hand-rolled, dependency-free SVG visualisations. Every chart is interactive
// (hover tooltips, hover highlight) and self-describing.
import { svgEl, el } from './dom.ts';
import { money, moneyFull, num, pct, segColor } from './format.ts';

// ── Shared floating tooltip for charts ──────────────────────────────────────
let chartTip: HTMLDivElement | null = null;
function tip(): HTMLDivElement {
  if (!chartTip) {
    chartTip = el('div', { class: 'chart-tooltip' }) as HTMLDivElement;
    document.body.append(chartTip);
  }
  return chartTip;
}
export function showTip(html: string, x: number, y: number): void {
  const t = tip();
  t.innerHTML = html;
  t.classList.add('visible');
  const w = t.offsetWidth;
  let left = x + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${y + 14}px`;
}
export function hideTip(): void {
  if (chartTip) chartTip.classList.remove('visible');
}
function bindTip(node: SVGElement, html: string): void {
  node.addEventListener('mousemove', (e) => showTip(html, e.clientX, e.clientY));
  node.addEventListener('mouseleave', hideTip);
}

// ── Horizontal bar chart ────────────────────────────────────────────────────
export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
  color?: string;
  onClick?: () => void;
  meta?: string; // extra tooltip line
}

export function horizontalBars(data: BarDatum[], opts: { valueFmt?: (n: number) => string } = {}): HTMLElement {
  const fmt = opts.valueFmt ?? money;
  const max = Math.max(1, ...data.map((d) => d.value));
  const wrap = el('div', { class: 'bars' });
  for (const d of data) {
    const row = el('div', { class: 'bar-row' + (d.onClick ? ' clickable' : '') });
    if (d.onClick) row.addEventListener('click', d.onClick);
    const label = el('div', { class: 'bar-label', title: d.label }, [d.label]);
    const track = el('div', { class: 'bar-track' });
    const fill = el('div', { class: 'bar-fill' });
    fill.style.width = `${(d.value / max) * 100}%`;
    fill.style.background = d.color ?? 'var(--accent)';
    const val = el('div', { class: 'bar-value' }, [fmt(d.value)]);
    track.append(fill, val);
    if (d.sub) {
      const sub = el('div', { class: 'bar-sub' }, [d.sub]);
      row.append(label, track, sub);
    } else {
      row.append(label, track);
    }
    row.addEventListener('mousemove', (e) =>
      showTip(`<strong>${d.label}</strong><br>${fmt(d.value)}${d.meta ? '<br>' + d.meta : ''}`, e.clientX, e.clientY)
    );
    row.addEventListener('mouseleave', hideTip);
    wrap.append(row);
  }
  return wrap;
}

// ── Treemap (squarified-ish slice/dice) ─────────────────────────────────────
export interface TreeNode { label: string; value: number; color: string; sub?: string; onClick?: () => void; }

export function treemap(nodes: TreeNode[], width: number, height: number): SVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'treemap', role: 'img' });
  const total = nodes.reduce((s, n) => s + n.value, 0) || 1;
  // slice-and-dice alternating: simple, deterministic, no dependency.
  layoutTreemap(nodes.slice().sort((a, b) => b.value - a.value), 0, 0, width, height, total, true).forEach((r) => {
    const g = svgEl('g', {});
    const rect = svgEl('rect', {
      x: r.x + 1, y: r.y + 1, width: Math.max(0, r.w - 2), height: Math.max(0, r.h - 2),
      rx: 3, fill: r.node.color, class: 'treemap-cell',
    });
    if (r.node.onClick) { rect.addEventListener('click', r.node.onClick); (rect as SVGElement).classList.add('clickable'); }
    bindTip(rect, `<strong>${r.node.label}</strong><br>${moneyFull(r.node.value)} · ${pct(r.node.value, total)}${r.node.sub ? '<br>' + r.node.sub : ''}`);
    g.append(rect);
    if (r.w > 62 && r.h > 26) {
      const t1 = svgEl('text', { x: r.x + 7, y: r.y + 17, class: 'treemap-label' });
      t1.textContent = r.node.label.length > Math.floor(r.w / 7) ? r.node.label.slice(0, Math.floor(r.w / 7)) + '…' : r.node.label;
      g.append(t1);
      if (r.h > 40) {
        const t2 = svgEl('text', { x: r.x + 7, y: r.y + 33, class: 'treemap-value' });
        t2.textContent = money(r.node.value);
        g.append(t2);
      }
    }
    svg.append(g);
  });
  return svg;
}

interface Placed { node: TreeNode; x: number; y: number; w: number; h: number; }
function layoutTreemap(nodes: TreeNode[], x: number, y: number, w: number, h: number, total: number, horizontal: boolean): Placed[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ node: nodes[0], x, y, w, h }];
  // Split the list into two halves of roughly equal value.
  let half = 0; let i = 0;
  const target = total / 2;
  while (i < nodes.length - 1 && half + nodes[i].value < target) { half += nodes[i].value; i++; }
  const first = nodes.slice(0, i);
  const second = nodes.slice(i);
  const firstVal = first.reduce((s, n) => s + n.value, 0);
  const secondVal = total - firstVal;
  const out: Placed[] = [];
  if (horizontal) {
    const w1 = w * (firstVal / total);
    out.push(...layoutTreemap(first, x, y, w1, h, firstVal, false));
    out.push(...layoutTreemap(second, x + w1, y, w - w1, h, secondVal, false));
  } else {
    const h1 = h * (firstVal / total);
    out.push(...layoutTreemap(first, x, y, w, h1, firstVal, true));
    out.push(...layoutTreemap(second, x, y + h1, w, h - h1, secondVal, true));
  }
  return out;
}

// ── Sankey / flow (two columns, bezier ribbons) ─────────────────────────────
export interface FlowInput {
  left: string[];
  right: string[];
  links: { a: number; c: number; value: number }[];
  leftColor?: (i: number) => string;
  rightColor?: (i: number) => string;
}

export function sankey(input: FlowInput, width: number, height: number): SVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'sankey', role: 'img' });
  const pad = 6;
  const nodeW = 13;
  const gap = 3;
  const leftTotals = input.left.map((_, i) => input.links.filter((l) => l.a === i).reduce((s, l) => s + l.value, 0));
  const rightTotals = input.right.map((_, i) => input.links.filter((l) => l.c === i).reduce((s, l) => s + l.value, 0));
  const grand = leftTotals.reduce((s, v) => s + v, 0) || 1;
  const usableL = height - pad * 2 - gap * (input.left.length - 1);
  const usableR = height - pad * 2 - gap * (input.right.length - 1);

  const leftY: { y: number; h: number }[] = [];
  let ly = pad;
  for (const t of leftTotals) { const hh = (t / grand) * usableL; leftY.push({ y: ly, h: hh }); ly += hh + gap; }
  const rightY: { y: number; h: number }[] = [];
  let ry = pad;
  for (const t of rightTotals) { const hh = (t / grand) * usableR; rightY.push({ y: ry, h: hh }); ry += hh + gap; }

  const leftCursor = leftY.map((n) => n.y);
  const rightCursor = rightY.map((n) => n.y);
  const x0 = 4 + nodeW;
  const x1 = width - 4 - nodeW;

  // ribbons first (under nodes)
  const ordered = input.links.slice().sort((a, b) => b.value - a.value);
  for (const l of ordered) {
    const lh = (l.value / grand) * usableL;
    const rh = (l.value / grand) * usableR;
    const sy = leftCursor[l.a]; leftCursor[l.a] += lh;
    const ty = rightCursor[l.c]; rightCursor[l.c] += rh;
    const mx = (x0 + x1) / 2;
    const ribbonColor = input.rightColor ? input.rightColor(l.c) : (input.leftColor ? input.leftColor(l.a) : 'var(--accent)');
    const path = svgEl('path', {
      d: `M${x0},${sy} C${mx},${sy} ${mx},${ty} ${x1},${ty} L${x1},${ty + rh} C${mx},${ty + rh} ${mx},${sy + lh} ${x0},${sy + lh} Z`,
      fill: ribbonColor,
      'fill-opacity': '0.32', class: 'ribbon',
    });
    bindTip(path, `<strong>${input.left[l.a]}</strong> → <strong>${input.right[l.c]}</strong><br>${moneyFull(l.value)} · ${pct(l.value, grand)}`);
    svg.append(path);
  }
  // left nodes
  input.left.forEach((name, i) => {
    const n = leftY[i];
    const rect = svgEl('rect', { x: 4, y: n.y, width: nodeW, height: Math.max(1, n.h), fill: input.leftColor ? input.leftColor(i) : 'var(--navy)', rx: 2 });
    bindTip(rect, `<strong>${name}</strong><br>${moneyFull(leftTotals[i])}`);
    svg.append(rect);
    if (n.h > 9) {
      const t = svgEl('text', { x: 4 + nodeW + 4, y: n.y + n.h / 2 + 3, class: 'sankey-label' });
      t.textContent = name.length > 28 ? name.slice(0, 27) + '…' : name;
      svg.append(t);
    }
  });
  // right nodes
  input.right.forEach((name, i) => {
    const n = rightY[i];
    const rect = svgEl('rect', { x: width - 4 - nodeW, y: n.y, width: nodeW, height: Math.max(1, n.h), fill: input.rightColor ? input.rightColor(i) : 'var(--accent)', rx: 2 });
    bindTip(rect, `<strong>${name}</strong><br>${moneyFull(rightTotals[i])}`);
    svg.append(rect);
    if (n.h > 9) {
      const t = svgEl('text', { x: width - 4 - nodeW - 4, y: n.y + n.h / 2 + 3, class: 'sankey-label', 'text-anchor': 'end' });
      t.textContent = name.length > 28 ? name.slice(0, 27) + '…' : name;
      svg.append(t);
    }
  });
  return svg;
}

// ── Force-directed bipartite network ────────────────────────────────────────
export interface NetNode { id: string; name: string; type: 'agency' | 'supplier'; value: number; seg: string | null; }
export interface NetLink { source: number; target: number; value: number; }

export function forceNetwork(nodes: NetNode[], links: NetLink[], width: number, height: number): SVGElement {
  interface P { x: number; y: number; vx: number; vy: number; }
  const N = nodes.length;
  const pos: P[] = nodes.map((n, i) => ({
    // seed agencies on the left band, suppliers on the right band
    x: n.type === 'agency' ? width * 0.28 : width * 0.72,
    y: (height * (i + 1)) / (N + 1) + (i % 2 ? 12 : -12),
    vx: 0, vy: 0,
  }));
  const maxV = Math.max(1, ...nodes.map((n) => n.value));
  const radius = (v: number) => 5 + 16 * Math.sqrt(v / maxV);

  // simple force simulation, fixed iterations (deterministic, no animation deps)
  const k = 0.02;
  for (let iter = 0; iter < 320; iter++) {
    // repulsion
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = (i % 3) - 1; dy = (j % 3) - 1; }
        const rep = 900 / d2;
        const d = Math.sqrt(d2);
        pos[i].vx += (dx / d) * rep; pos[i].vy += (dy / d) * rep;
        pos[j].vx -= (dx / d) * rep; pos[j].vy -= (dy / d) * rep;
      }
    }
    // springs
    for (const l of links) {
      const a = pos[l.source], b = pos[l.target];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (d - 120) * k;
      a.vx += (dx / d) * force; a.vy += (dy / d) * force;
      b.vx -= (dx / d) * force; b.vy -= (dy / d) * force;
    }
    // gravity toward column x + integrate
    for (let i = 0; i < N; i++) {
      const targetX = nodes[i].type === 'agency' ? width * 0.3 : width * 0.7;
      pos[i].vx += (targetX - pos[i].x) * 0.01;
      pos[i].vy += (height / 2 - pos[i].y) * 0.004;
      pos[i].x += Math.max(-8, Math.min(8, pos[i].vx));
      pos[i].y += Math.max(-8, Math.min(8, pos[i].vy));
      pos[i].vx *= 0.82; pos[i].vy *= 0.82;
      const r = radius(nodes[i].value);
      pos[i].x = Math.max(r + 2, Math.min(width - r - 2, pos[i].x));
      pos[i].y = Math.max(r + 2, Math.min(height - r - 2, pos[i].y));
    }
  }

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'network', role: 'img' });
  const linkLayer = svgEl('g', {});
  const nodeLayer = svgEl('g', {});
  const maxL = Math.max(1, ...links.map((l) => l.value));
  const linkEls: SVGElement[] = [];
  links.forEach((l) => {
    const a = pos[l.source], b = pos[l.target];
    const line = svgEl('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: 'var(--border-strong)', 'stroke-opacity': '0.35',
      'stroke-width': String(0.5 + 3.5 * (l.value / maxL)),
    });
    (line as SVGElement).dataset.s = String(l.source);
    (line as SVGElement).dataset.t = String(l.target);
    bindTip(line, `<strong>${nodes[l.source].name}</strong> → <strong>${nodes[l.target].name}</strong><br>${moneyFull(l.value)}`);
    linkEls.push(line);
    linkLayer.append(line);
  });
  nodes.forEach((n, i) => {
    const p = pos[i];
    const g = svgEl('g', { class: 'net-node' });
    const c = svgEl('circle', {
      cx: p.x, cy: p.y, r: radius(n.value),
      fill: n.type === 'agency' ? 'var(--navy)' : segColor(n.seg || '00'),
      stroke: '#fff', 'stroke-width': '1.5',
    });
    const highlight = () => {
      linkEls.forEach((le) => {
        const on = le.dataset.s === String(i) || le.dataset.t === String(i);
        le.setAttribute('stroke-opacity', on ? '0.9' : '0.06');
        le.setAttribute('stroke', on ? 'var(--accent)' : 'var(--border-strong)');
      });
    };
    const reset = () => linkEls.forEach((le) => { le.setAttribute('stroke-opacity', '0.35'); le.setAttribute('stroke', 'var(--border-strong)'); });
    c.addEventListener('mouseenter', highlight);
    c.addEventListener('mouseleave', reset);
    bindTip(c, `<strong>${n.name}</strong><br>${n.type === 'agency' ? 'Agency' : 'Supplier'} · ${moneyFull(n.value)}`);
    g.append(c);
    if (radius(n.value) > 11) {
      const t = svgEl('text', { x: p.x, y: p.y + radius(n.value) + 11, class: 'net-label', 'text-anchor': 'middle' });
      t.textContent = n.name.length > 22 ? n.name.slice(0, 21) + '…' : n.name;
      g.append(t);
    }
    nodeLayer.append(g);
  });
  svg.append(linkLayer, nodeLayer);
  return svg;
}

// ── Heatmap matrix ──────────────────────────────────────────────────────────
export function heatmap(
  rowLabels: { name: string; onClick?: () => void }[],
  colLabels: string[],
  grid: number[][],
  width: number
): HTMLElement {
  const max = Math.max(1, ...grid.flat());
  const wrap = el('div', { class: 'heatmap-wrap' });
  const table = el('table', { class: 'heatmap' });
  const thead = el('thead');
  const hrow = el('tr', {}, [el('th', { class: 'hm-corner' }, ['Agency \\ Category'])]);
  colLabels.forEach((c) => hrow.append(el('th', { class: 'hm-col', title: c }, [el('span', {}, [c])])));
  thead.append(hrow);
  const tbody = el('tbody');
  rowLabels.forEach((r, ri) => {
    const tr = el('tr');
    const th = el('th', { class: 'hm-row' + (r.onClick ? ' clickable' : ''), title: r.name }, [r.name]);
    if (r.onClick) th.addEventListener('click', r.onClick);
    tr.append(th);
    grid[ri].forEach((v, ci) => {
      const intensity = v > 0 ? 0.08 + 0.92 * Math.sqrt(v / max) : 0;
      const td = el('td', { class: 'hm-cell' });
      td.style.background = v > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, transparent)` : 'transparent';
      if (v > 0) {
        td.addEventListener('mousemove', (e) =>
          showTip(`<strong>${rowLabels[ri].name}</strong><br>${colLabels[ci]}<br>${moneyFull(v)}`, e.clientX, e.clientY));
        td.addEventListener('mouseleave', hideTip);
      }
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.style.setProperty('--hm-width', `${width}px`);
  wrap.append(table);
  return wrap;
}

// ── Column chart (monthly trend) ────────────────────────────────────────────
export function columns(
  data: { label: string; value: number; sub?: string }[],
  height: number
): HTMLElement {
  const max = Math.max(1, ...data.map((d) => d.value));
  const wrap = el('div', { class: 'columns' });
  wrap.style.height = `${height}px`;
  for (const d of data) {
    const col = el('div', { class: 'column' });
    const bar = el('div', { class: 'column-bar' });
    bar.style.height = `${(d.value / max) * 100}%`;
    bar.addEventListener('mousemove', (e) =>
      showTip(`<strong>${d.label}</strong><br>${moneyFull(d.value)}${d.sub ? '<br>' + d.sub : ''}`, e.clientX, e.clientY));
    bar.addEventListener('mouseleave', hideTip);
    const lab = el('div', { class: 'column-label' }, [d.label]);
    col.append(bar, lab);
    wrap.append(col);
  }
  return wrap;
}

// ── Legend ──────────────────────────────────────────────────────────────────
export function legend(items: { color: string; label: string }[]): HTMLElement {
  const wrap = el('div', { class: 'legend' });
  for (const it of items) {
    wrap.append(el('span', { class: 'legend-item' }, [
      el('span', { class: 'legend-swatch' }, []),
      it.label,
    ]));
    (wrap.lastChild as HTMLElement).querySelector('.legend-swatch')!.setAttribute('style', `background:${it.color}`);
  }
  return wrap;
}

export { num };
