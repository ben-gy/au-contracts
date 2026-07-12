// Hand-rolled SVG visualisations. No chart library.
import { el, svgEl } from './dom';
import { money, moneyFull, num, monthLabel, truncate, esc } from './format';
import { segColor } from './colors';
import { showVizTip, hideTip } from './tooltip';

// ─────────────── Horizontal bar list (HTML) ───────────────
export interface BarItem { label: string; value: number; color?: string; onClick?: () => void; }
export function hbars(items: BarItem[], opts: { max?: number } = {}): HTMLElement {
  const max = opts.max ?? Math.max(1, ...items.map((i) => i.value));
  const wrap = el('div', { class: 'hbars' });
  for (const it of items) {
    const pctW = Math.max(0.5, (it.value / max) * 100);
    const label = el('div', { class: 'hbar-label', title: it.label }, [it.label]);
    if (it.onClick) { label.classList.add('linklike'); label.onclick = it.onClick; }
    const fill = el('div', { class: 'hbar-fill' });
    fill.style.width = `${pctW}%`;
    fill.style.background = it.color || 'var(--accent-primary)';
    const track = el('div', { class: 'hbar-track' }, [fill]);
    const row = el('div', { class: 'hbar-row' }, [label, track, el('div', { class: 'hbar-val' }, [money(it.value)])]);
    wrap.append(row);
  }
  return wrap;
}

// ─────────────── Monthly line / area chart (SVG) ───────────────
export function monthlyChart(data: { m: string; total: number }[]): SVGElement {
  const W = 960, H = 300, pad = { l: 64, r: 20, t: 20, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' }) as SVGSVGElement;
  if (!data.length) return svg;
  const max = Math.max(...data.map((d) => d.total)) * 1.08;
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  // gridlines + y labels
  for (let g = 0; g <= 4; g++) {
    const gv = (max / 4) * g;
    const gy = y(gv);
    svg.append(svgEl('line', { x1: pad.l, y1: gy, x2: W - pad.r, y2: gy, stroke: 'var(--border-subtle)', 'stroke-width': 1 }));
    const t = svgEl('text', { x: pad.l - 8, y: gy + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-tertiary)' });
    t.textContent = money(gv);
    svg.append(t);
  }
  // area
  const areaPts = data.map((d, i) => `${x(i)},${y(d.total)}`).join(' ');
  const area = svgEl('polygon', { points: `${pad.l},${y(0)} ${areaPts} ${x(data.length - 1)},${y(0)}`, fill: 'var(--accent-primary)', opacity: 0.12 });
  svg.append(area);
  const line = svgEl('polyline', { points: areaPts, fill: 'none', stroke: 'var(--accent-primary)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  svg.append(line);

  data.forEach((d, i) => {
    const cx = x(i), cy = y(d.total);
    const dot = svgEl('circle', { cx, cy, r: 4, fill: 'var(--accent-primary)', stroke: 'var(--bg-surface)', 'stroke-width': 1.5 });
    (dot as SVGElement).style.cursor = 'pointer';
    dot.addEventListener('mousemove', (e) => showVizTip(`<strong>${monthLabel(d.m)}</strong>${moneyFull(d.total)} in contracts signed`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
    dot.addEventListener('mouseleave', hideTip);
    svg.append(dot);
    // x labels (every other for density)
    if (i % 2 === 0 || data.length <= 14) {
      const t = svgEl('text', { x: cx, y: H - pad.b + 20, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--text-tertiary)' });
      t.textContent = monthLabel(d.m).replace(' 20', " '");
      svg.append(t);
    }
  });
  return svg;
}

// ─────────────── Treemap (SVG, squarified-ish) ───────────────
export function treemap(items: { seg: string; name: string; total: number }[], w = 960, h = 420): SVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img' });
  const total = items.reduce((s, i) => s + i.total, 0) || 1;
  // Simple slice-and-dice by rows using a greedy squarify.
  const data = [...items].sort((a, b) => b.total - a.total);
  let x = 0, y = 0, availW = w, availH = h;
  let i = 0;
  while (i < data.length) {
    const horizontal = availW >= availH;
    const side = horizontal ? availH : availW;
    // take a row that fills reasonably
    const row: typeof data = [];
    let rowSum = 0;
    let bestRatio = Infinity;
    while (i < data.length) {
      const next = data[i];
      const testSum = rowSum + next.total;
      const rowArea = (testSum / total) * (w * h);
      const rowThick = rowArea / side;
      const worst = Math.max(
        ...[...row, next].map((it) => {
          const cellArea = (it.total / total) * (w * h);
          const cellLen = cellArea / rowThick;
          return Math.max(rowThick / cellLen, cellLen / rowThick);
        }),
      );
      if (worst > bestRatio && row.length) break;
      row.push(next); rowSum = testSum; bestRatio = worst; i++;
      if (row.length >= 6) break;
    }
    const rowArea = (rowSum / total) * (w * h);
    const rowThick = Math.min(horizontal ? availW : availH, rowArea / side);
    let off = 0;
    for (const it of row) {
      const cellArea = (it.total / total) * (w * h);
      const cellLen = rowThick > 0 ? cellArea / rowThick : 0;
      const cx = horizontal ? x + off : x;
      const cy = horizontal ? y : y + off;
      const cw = horizontal ? cellLen : rowThick;
      const ch = horizontal ? rowThick : cellLen;
      drawCell(svg, cx, cy, cw, ch, it);
      off += horizontal ? cellLen : cellLen;
    }
    if (horizontal) { y += rowThick; availH -= rowThick; } else { x += rowThick; availW -= rowThick; }
    if (availW < 1 || availH < 1) break;
  }
  return svg;
}

function drawCell(svg: SVGElement, x: number, y: number, w: number, h: number, it: { seg: string; name: string; total: number }): void {
  if (w <= 0 || h <= 0) return;
  const g = svgEl('g', {});
  const rect = svgEl('rect', { x: x + 1, y: y + 1, width: Math.max(0, w - 2), height: Math.max(0, h - 2), fill: segColor(it.seg), rx: 3, opacity: 0.92 });
  (g as SVGElement).style.cursor = 'pointer';
  g.addEventListener('mousemove', (e) => showVizTip(`<strong>${esc(it.name)}</strong>${moneyFull(it.total)}`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
  g.addEventListener('mouseleave', hideTip);
  g.append(rect);
  if (w > 62 && h > 26) {
    const t1 = svgEl('text', { x: x + 8, y: y + 20, 'font-size': 12, 'font-weight': 600, fill: '#fff' });
    t1.textContent = truncate(it.name, Math.floor(w / 8));
    g.append(t1);
    if (h > 40) {
      const t2 = svgEl('text', { x: x + 8, y: y + 37, 'font-size': 12, fill: 'rgba(255,255,255,0.9)', 'font-family': 'var(--font-mono)' });
      t2.textContent = money(it.total);
      g.append(t2);
    }
  }
  svg.append(g);
}

// ─────────────── Matrix heatmap (SVG) ───────────────
export function matrixHeatmap(m: { agencies: { name: string; total: number }[]; segments: { seg: string; name: string }[]; cells: number[][] }): SVGElement {
  const rowH = 26, colW = 62, labelW = 220, headH = 130;
  const W = labelW + m.segments.length * colW + 10;
  const H = headH + m.agencies.length * rowH + 10;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' });
  const maxCell = Math.max(1, ...m.cells.flat());
  // column headers (rotated)
  m.segments.forEach((s, c) => {
    const cx = labelW + c * colW + colW / 2;
    const t = svgEl('text', { x: cx, y: headH - 8, 'font-size': 11, fill: 'var(--text-secondary)', transform: `rotate(-40 ${cx} ${headH - 8})`, 'text-anchor': 'start' });
    t.textContent = truncate(s.name, 22);
    svg.append(t);
  });
  m.agencies.forEach((a, r) => {
    const ry = headH + r * rowH;
    const lt = svgEl('text', { x: labelW - 8, y: ry + rowH / 2 + 4, 'font-size': 11, fill: 'var(--text-primary)', 'text-anchor': 'end' });
    lt.textContent = truncate(a.name, 34);
    svg.append(lt);
    m.segments.forEach((s, c) => {
      const v = m.cells[r][c];
      const intensity = v > 0 ? 0.12 + 0.85 * Math.sqrt(v / maxCell) : 0;
      const cx = labelW + c * colW;
      const cell = svgEl('rect', { x: cx + 1, y: ry + 1, width: colW - 2, height: rowH - 2, rx: 2, fill: segColor(s.seg), opacity: intensity || 0.04 });
      if (v > 0) {
        (cell as SVGElement).style.cursor = 'pointer';
        cell.addEventListener('mousemove', (e) => showVizTip(`<strong>${esc(a.name)}</strong>${esc(s.name)}<br>${moneyFull(v)}`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
        cell.addEventListener('mouseleave', hideTip);
      }
      svg.append(cell);
    });
  });
  return svg;
}

// ─────────────── Sankey / flow (SVG, category → agency) ───────────────
export function sankey(
  flows: { segments: { seg: string; name: string; total: number }[]; agencies: { name: string; total: number }[]; links: { seg: string; agency: string; total: number }[] },
): SVGElement {
  const W = 960, H = 520, nodeW = 16, colGap = W - nodeW - 220;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' });
  const pad = 6;
  const segTotal = flows.segments.reduce((s, x) => s + x.total, 0) || 1;
  const agTotal = flows.agencies.reduce((s, x) => s + x.total, 0) || 1;
  const scale = (H - pad * (Math.max(flows.segments.length, flows.agencies.length) + 1)) / Math.max(segTotal, agTotal);

  const segPos = new Map<string, { y: number; h: number; mid: number }>();
  let yy = pad;
  for (const s of flows.segments) { const h = Math.max(2, s.total * scale); segPos.set(s.seg, { y: yy, h, mid: yy + h / 2 }); yy += h + pad; }
  const agPos = new Map<string, { y: number; h: number; mid: number }>();
  yy = pad;
  for (const a of flows.agencies) { const h = Math.max(2, a.total * scale); agPos.set(a.name, { y: yy, h, mid: yy + h / 2 }); yy += h + pad; }

  const leftX = 200, rightX = leftX + colGap;
  // track offsets used along each node band
  const segOff = new Map<string, number>();
  const agOff = new Map<string, number>();

  const links = [...flows.links].sort((a, b) => b.total - a.total);
  for (const lk of links) {
    const sp = segPos.get(lk.seg); const ap = agPos.get(lk.agency);
    if (!sp || !ap) continue;
    const lh = Math.max(1, lk.total * scale);
    const so = segOff.get(lk.seg) || 0; const ao = agOff.get(lk.agency) || 0;
    const y0 = sp.y + so + lh / 2; const y1 = ap.y + ao + lh / 2;
    segOff.set(lk.seg, so + lh); agOff.set(lk.agency, ao + lh);
    const x0 = leftX + nodeW; const x1 = rightX;
    const cx = (x0 + x1) / 2;
    const path = svgEl('path', {
      d: `M${x0},${y0} C${cx},${y0} ${cx},${y1} ${x1},${y1}`,
      fill: 'none', stroke: segColor(lk.seg), 'stroke-width': lh, opacity: 0.28,
    });
    (path as SVGElement).style.cursor = 'pointer';
    path.addEventListener('mouseenter', () => path.setAttribute('opacity', '0.55'));
    path.addEventListener('mousemove', (e) => showVizTip(`<strong>${esc(flows.segments.find((s) => s.seg === lk.seg)?.name || '')} → ${esc(lk.agency)}</strong>${moneyFull(lk.total)}`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
    path.addEventListener('mouseleave', () => { path.setAttribute('opacity', '0.28'); hideTip(); });
    svg.append(path);
  }
  // nodes + labels
  for (const s of flows.segments) {
    const p = segPos.get(s.seg)!;
    svg.append(svgEl('rect', { x: leftX, y: p.y, width: nodeW, height: p.h, fill: segColor(s.seg), rx: 2 }));
    const t = svgEl('text', { x: leftX - 6, y: p.mid + 4, 'font-size': 11, fill: 'var(--text-primary)', 'text-anchor': 'end' });
    t.textContent = truncate(s.name, 26);
    svg.append(t);
  }
  for (const a of flows.agencies) {
    const p = agPos.get(a.name)!;
    svg.append(svgEl('rect', { x: rightX, y: p.y, width: nodeW, height: p.h, fill: 'var(--navy)', rx: 2 }));
    const t = svgEl('text', { x: rightX + nodeW + 6, y: p.mid + 4, 'font-size': 11, fill: 'var(--text-primary)', 'text-anchor': 'start' });
    t.textContent = truncate(a.name, 30);
    svg.append(t);
  }
  return svg;
}

// ─────────────── Force-directed network (SVG) ───────────────
export function network(
  data: { suppliers: { name: string; total: number; cat: string }[]; agencies: { name: string; total: number }[]; edges: { s: string; a: string; total: number }[] },
  onNode?: (kind: 'supplier' | 'agency', name: string) => void,
): SVGElement {
  const W = 960, H = 620;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' }) as SVGSVGElement;
  interface N { id: string; kind: 'supplier' | 'agency'; total: number; cat?: string; x: number; y: number; vx: number; vy: number; r: number; }
  const nodes = new Map<string, N>();
  const maxSup = Math.max(1, ...data.suppliers.map((s) => s.total));
  const maxAg = Math.max(1, ...data.agencies.map((a) => a.total));
  // deterministic initial layout (no Math.random for reproducibility)
  data.suppliers.forEach((s, i) => {
    const ang = (i / data.suppliers.length) * Math.PI * 2;
    nodes.set(`s:${s.name}`, { id: s.name, kind: 'supplier', total: s.total, cat: s.cat, x: W / 2 + Math.cos(ang) * 230, y: H / 2 + Math.sin(ang) * 230, vx: 0, vy: 0, r: 5 + 16 * Math.sqrt(s.total / maxSup) });
  });
  data.agencies.forEach((a, i) => {
    const ang = (i / data.agencies.length) * Math.PI * 2 + 0.3;
    nodes.set(`a:${a.name}`, { id: a.name, kind: 'agency', total: a.total, x: W / 2 + Math.cos(ang) * 90, y: H / 2 + Math.sin(ang) * 90, vx: 0, vy: 0, r: 6 + 14 * Math.sqrt(a.total / maxAg) });
  });
  const edges = data.edges.map((e) => ({ src: nodes.get(`s:${e.s}`), dst: nodes.get(`a:${e.a}`), total: e.total })).filter((e) => e.src && e.dst) as { src: N; dst: N; total: number }[];
  const maxEdge = Math.max(1, ...edges.map((e) => e.total));

  // simple force sim
  const arr = [...nodes.values()];
  for (let iter = 0; iter < 260; iter++) {
    // repulsion
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const rep = 5200 / d2;
        const fx = (dx / d) * rep, fy = (dy / d) * rep;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    // attraction along edges
    for (const e of edges) {
      const dx = e.dst.x - e.src.x, dy = e.dst.y - e.src.y;
      const strength = 0.006 * (0.4 + e.total / maxEdge);
      const fx = dx * strength, fy = dy * strength;
      e.src.vx += fx; e.src.vy += fy; e.dst.vx -= fx; e.dst.vy -= fy;
    }
    // centering + integrate
    for (const n of arr) {
      n.vx += (W / 2 - n.x) * 0.002;
      n.vy += (H / 2 - n.y) * 0.002;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += Math.max(-12, Math.min(12, n.vx));
      n.y += Math.max(-12, Math.min(12, n.vy));
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
    }
  }

  const gEdges = svgEl('g', {});
  for (const e of edges) {
    const ln = svgEl('line', { x1: e.src.x, y1: e.src.y, x2: e.dst.x, y2: e.dst.y, stroke: 'var(--border-strong)', 'stroke-width': 0.4 + 3 * (e.total / maxEdge), opacity: 0.35 });
    gEdges.append(ln);
  }
  svg.append(gEdges);
  for (const n of arr) {
    const g = svgEl('g', {});
    (g as SVGElement).style.cursor = 'pointer';
    const c = svgEl('circle', { cx: n.x, cy: n.y, r: n.r, fill: n.kind === 'agency' ? 'var(--navy)' : segColor(n.cat || '99'), stroke: 'var(--bg-surface)', 'stroke-width': 1.5, opacity: 0.92 });
    g.append(c);
    if (n.r > 11) {
      const t = svgEl('text', { x: n.x, y: n.y + n.r + 11, 'font-size': 10, fill: 'var(--text-secondary)', 'text-anchor': 'middle' });
      t.textContent = truncate(n.id, 18);
      g.append(t);
    }
    g.addEventListener('mousemove', (ev) => showVizTip(`<strong>${esc(n.id)}</strong>${n.kind === 'agency' ? 'Agency' : 'Supplier'} · ${moneyFull(n.total)}`, (ev as MouseEvent).clientX, (ev as MouseEvent).clientY));
    g.addEventListener('mouseleave', hideTip);
    if (onNode) g.addEventListener('click', () => onNode(n.kind, n.id));
    svg.append(g);
  }
  return svg;
}

// ─────────────── Donut (for method / consulting share) ───────────────
export function donut(items: { label: string; value: number; color: string }[], size = 200): HTMLElement {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - 8, cx = size / 2, cy = size / 2, sw = 30;
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: String(size), height: String(size) });
  let a0 = -Math.PI / 2;
  for (const it of items) {
    const frac = it.value / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const path = svgEl('path', { d: `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`, fill: 'none', stroke: it.color, 'stroke-width': sw });
    (path as SVGElement).style.cursor = 'pointer';
    path.addEventListener('mousemove', (e) => showVizTip(`<strong>${esc(it.label)}</strong>${moneyFull(it.value)} · ${(frac * 100).toFixed(1)}%`, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
    path.addEventListener('mouseleave', hideTip);
    svg.append(path);
    a0 = a1;
  }
  const wrap = el('div', {});
  wrap.append(svg);
  return wrap;
}

export function legend(items: { label: string; color: string }[]): HTMLElement {
  const wrap = el('div', { class: 'legend' });
  for (const it of items) {
    const sw = el('span', { class: 'legend-swatch' });
    sw.style.background = it.color;
    wrap.append(el('span', { class: 'legend-item' }, [sw, it.label]));
  }
  return wrap;
}

export { num };
