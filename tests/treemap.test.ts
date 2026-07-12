// Positional correctness for the slice-and-dice treemap layout (src/charts.ts).
// Adapted from patterns/tests/layout.test.ts.
//
// WHY positions and not just area: an area-only check passes on visually broken
// layouts. The original slice-and-dice left one partition empty whenever the
// leading node met the half-value target (which happens on nearly every real
// input, including any group that recurses down to a pair), sending the layout
// into infinite recursion — green area math, dead render. Bounds, pairwise
// overlap, no-NaN and per-cell proportionality are what catch it.
import { describe, expect, it } from 'vitest';
import { layoutTreemap, type Placed, type TreeNode } from '../src/charts.ts';

const EPS = 1e-6;

function overlapArea(a: Placed, b: Placed): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

// Drive layoutTreemap exactly as treemap() does: sort by value descending,
// total = sum (|| 1 fallback), initial split horizontal.
function layout(values: number[], W: number, H: number): Placed[] {
  const nodes: TreeNode[] = values.map((v, i) => ({ label: 'n' + i, value: v, color: '#000' }));
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const sorted = nodes.slice().sort((a, b) => b.value - a.value);
  return layoutTreemap(sorted, 0, 0, W, H, total, true);
}

// Deterministic pseudo-random values — no Math.random() in tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('treemap slice-and-dice — positional correctness', () => {
  const boxes: Array<[number, number]> = [[1000, 460], [200, 900], [500, 500]];
  const rand = mulberry32(7);
  const valueSets: number[][] = [
    [5, 3, 2, 1],
    [100],
    [1, 1],                                 // equal pair — leading node == target
    [60, 40],                               // dominant leading node (> half)
    [80, 15, 5],                            // dominant leading node, three cells
    Array.from({ length: 9 }, () => 1),     // all equal
    Array.from({ length: 50 }, () => 1 + Math.floor(rand() * 200)),
  ];

  for (const [W, H] of boxes) {
    for (const values of valueSets) {
      it(`lays out ${values.length} values in ${W}×${H}: in-bounds, no overlap, no NaN, area conserved`, () => {
        const rects = layout(values, W, H);
        const total = values.reduce((a, b) => a + b, 0);
        expect(rects).toHaveLength(values.length);
        for (const r of rects) {
          // no NaN / negatives
          expect(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h)).toBe(true);
          expect(r.w).toBeGreaterThanOrEqual(0);
          expect(r.h).toBeGreaterThanOrEqual(0);
          // within bounds
          expect(r.x).toBeGreaterThanOrEqual(-EPS);
          expect(r.y).toBeGreaterThanOrEqual(-EPS);
          expect(r.x + r.w).toBeLessThanOrEqual(W + EPS * W);
          expect(r.y + r.h).toBeLessThanOrEqual(H + EPS * H);
        }
        // no pairwise overlap (>0.5px² fails)
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            expect(overlapArea(rects[i], rects[j])).toBeLessThan(0.5);
          }
        }
        // area conservation + per-cell proportionality (each cell's area tracks
        // its own value, keyed off the node it carries)
        const sumArea = rects.reduce((s, r) => s + r.w * r.h, 0);
        expect(Math.abs(sumArea - W * H)).toBeLessThan(W * H * 1e-6);
        for (const r of rects) {
          const expected = (r.node.value / total) * W * H;
          expect(Math.abs(r.w * r.h - expected)).toBeLessThan(Math.max(1e-6, expected * 1e-6));
        }
      });
    }
  }

  it('handles degenerates: empty, single fills box, zero-total stays finite', () => {
    expect(layout([], 100, 100)).toEqual([]);
    const [single] = layout([42], 100, 80);
    expect(single.w * single.h).toBeCloseTo(8000, 6);
    // an all-zero group must not NaN or escape the box (proportionality is
    // undefined when every value is 0, so we only assert finiteness + bounds).
    const zeros = layout([0, 0, 0], 100, 100);
    expect(zeros).toHaveLength(3);
    for (const r of zeros) {
      expect(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h)).toBe(true);
      expect(r.x).toBeGreaterThanOrEqual(-EPS);
      expect(r.y).toBeGreaterThanOrEqual(-EPS);
      expect(r.x + r.w).toBeLessThanOrEqual(100 + EPS);
      expect(r.y + r.h).toBeLessThanOrEqual(100 + EPS);
    }
  });
});
