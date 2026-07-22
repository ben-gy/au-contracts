// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Aggregate raw AusTender contract rows into compact browser payloads.
//
// Reads pipeline/raw.json (written by collect.mjs) and writes:
//   public/data/aggregates.json  — every dashboard view except the raw table,
//                                   computed over ALL contracts in the year.
//   public/data/contracts.json   — the largest TABLE_CAP contracts for the
//                                   searchable table (with a visible note in
//                                   aggregates.meta about how many are shown).
//
// No external dependencies. Run: node pipeline/aggregate.mjs

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_PATH = join(__dirname, 'raw.json');
const OUT_DIR = join(__dirname, '..', 'public', 'data');

const TABLE_CAP = 12000; // largest contracts shipped to the searchable table
const TOP_SUPPLIERS = 300;
const NET_AGENCIES = 40;
const NET_SUPPLIERS = 55;
const NET_MAX_LINKS = 200;
const FLOW_AGENCIES = 12;
const FLOW_CATEGORIES = 12;
const MATRIX_AGENCIES = 24;
const MATRIX_CATEGORIES = 16;

// Row column indices (must match collect.mjs extractRows()).
const SUP = 0, AG = 1, AMT = 2, DATE = 3, SEG = 4, METHOD = 5, STATE = 6, DESC = 7, CN = 8;

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Fixed histogram buckets (AUD). Upper bound is Infinity.
const HIST_EDGES = [
  0, 1e3, 1e4, 5e4, 1e5, 5e5, 1e6, 5e6, 1e7, 5e7, 1e8, 5e8, 1e9, Infinity,
];
const HIST_LABELS = [
  '<$1k', '$1k–10k', '$10k–50k', '$50k–100k', '$100k–500k', '$500k–1m',
  '$1m–5m', '$5m–10m', '$10m–50m', '$50m–100m', '$100m–500m', '$500m–1b', '$1b+',
];

async function main() {
  const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
  const { meta, suppliers, agencies, segs, rows } = raw;
  const segName = new Map(segs);
  const states = meta.states;
  const methods = meta.methods;

  // ── Per-supplier and per-agency accumulators ──
  const supAgg = suppliers.map(() => ({ value: 0, count: 0, limited: 0, agencies: new Set(), segVal: {}, stateVal: {} }));
  const agAgg = agencies.map(() => ({ value: 0, count: 0, limited: 0, suppliers: new Set(), segVal: {} }));

  const monthly = new Map();
  const methodAgg = methods.map(() => ({ value: 0, count: 0 }));
  const stateAgg = states.map(() => ({ value: 0, count: 0 }));
  const segAgg = new Map(); // seg -> {value,count}
  const hist = HIST_LABELS.map(() => ({ count: 0, value: 0 }));
  // Pair aggregation for network (only among top agencies/suppliers, filled in 2nd pass).

  let totalValue = 0;
  for (const r of rows) {
    const amt = r[AMT];
    totalValue += amt;
    const s = supAgg[r[SUP]];
    const a = agAgg[r[AG]];
    const isLimited = r[METHOD] === 0;
    s.value += amt; s.count++; if (isLimited) s.limited += amt; s.agencies.add(r[AG]);
    a.value += amt; a.count++; if (isLimited) a.limited += amt; a.suppliers.add(r[SUP]);
    if (r[SEG]) {
      s.segVal[r[SEG]] = (s.segVal[r[SEG]] || 0) + amt;
      a.segVal[r[SEG]] = (a.segVal[r[SEG]] || 0) + amt;
      const sg = segAgg.get(r[SEG]) || { value: 0, count: 0 };
      sg.value += amt; sg.count++; segAgg.set(r[SEG], sg);
    }
    s.stateVal[r[STATE]] = (s.stateVal[r[STATE]] || 0) + amt;
    // month
    const ym = r[DATE] ? r[DATE].slice(0, 7) : 'unknown';
    const mo = monthly.get(ym) || { value: 0, count: 0 };
    mo.value += amt; mo.count++; monthly.set(ym, mo);
    // method / state
    methodAgg[r[METHOD]].value += amt; methodAgg[r[METHOD]].count++;
    stateAgg[r[STATE]].value += amt; stateAgg[r[STATE]].count++;
    // histogram
    for (let b = 0; b < HIST_EDGES.length - 1; b++) {
      if (amt >= HIST_EDGES[b] && amt < HIST_EDGES[b + 1]) { hist[b].count++; hist[b].value += amt; break; }
    }
  }

  const topSegOf = (segVal) => {
    let best = null, bestV = -1;
    for (const [seg, v] of Object.entries(segVal)) if (v > bestV) { bestV = v; best = seg; }
    return best;
  };
  const topStateOf = (stateVal) => {
    let best = states.indexOf('Unknown'), bestV = -1;
    for (const [idx, v] of Object.entries(stateVal)) if (v > bestV) { bestV = v; best = +idx; }
    return best;
  };

  // ── Supplier leaderboard ──
  const supRank = suppliers
    .map((name, i) => ({ i, name, ...supAgg[i] }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.value - a.value);
  const topSuppliers = supRank.slice(0, TOP_SUPPLIERS).map((s) => ({
    name: s.name,
    slug: slug(s.name),
    value: s.value,
    count: s.count,
    avg: Math.round(s.value / s.count),
    agencies: s.agencies.size,
    limitedPct: s.value ? Math.round((s.limited / s.value) * 100) : 0,
    topSeg: topSegOf(s.segVal),
    state: topStateOf(s.stateVal),
  }));

  // ── Agency leaderboard (all agencies) ──
  const agRank = agencies
    .map((name, i) => ({ i, name, ...agAgg[i] }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.value - a.value);
  const topAgencies = agRank.map((a) => ({
    name: a.name,
    slug: slug(a.name),
    value: a.value,
    count: a.count,
    avg: Math.round(a.value / a.count),
    suppliers: a.suppliers.size,
    limitedPct: a.value ? Math.round((a.limited / a.value) * 100) : 0,
    topSeg: topSegOf(a.segVal),
  }));

  // ── Categories ──
  const categories = Array.from(segAgg.entries())
    .map(([seg, v]) => ({ seg, name: segName.get(seg) || seg, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value);

  // ── Network (bipartite supplier↔agency) ──
  const netAgencySet = new Set(agRank.slice(0, NET_AGENCIES).map((a) => a.i));
  const netSupplierSet = new Set(supRank.slice(0, NET_SUPPLIERS).map((s) => s.i));
  const pairMap = new Map(); // `${sup}|${ag}` -> value
  for (const r of rows) {
    if (netAgencySet.has(r[AG]) && netSupplierSet.has(r[SUP])) {
      const k = r[SUP] + '|' + r[AG];
      pairMap.set(k, (pairMap.get(k) || 0) + r[AMT]);
    }
  }
  const links = Array.from(pairMap.entries())
    .map(([k, v]) => { const [s, a] = k.split('|').map(Number); return { s, a, value: v }; })
    .sort((x, y) => y.value - x.value)
    .slice(0, NET_MAX_LINKS);
  const usedSup = new Set(), usedAg = new Set();
  for (const l of links) { usedSup.add(l.s); usedAg.add(l.a); }
  const nodeList = [];
  const nodeIndex = new Map();
  const addNode = (key, node) => { nodeIndex.set(key, nodeList.length); nodeList.push(node); };
  for (const i of usedAg) addNode('a' + i, {
    id: 'a' + i, name: agencies[i], type: 'agency', value: agAgg[i].value, seg: topSegOf(agAgg[i].segVal),
  });
  for (const i of usedSup) addNode('s' + i, {
    id: 's' + i, name: suppliers[i], type: 'supplier', value: supAgg[i].value, seg: topSegOf(supAgg[i].segVal),
  });
  const network = {
    nodes: nodeList,
    links: links.map((l) => ({ source: nodeIndex.get('s' + l.s), target: nodeIndex.get('a' + l.a), value: l.value })),
  };

  // ── Flow (agency → category) ──
  const flowAgencies = agRank.slice(0, FLOW_AGENCIES);
  const flowCatSegs = categories.slice(0, FLOW_CATEGORIES).map((c) => c.seg);
  const flowAgSet = new Map(flowAgencies.map((a, idx) => [a.i, idx]));
  const flowCatSet = new Map(flowCatSegs.map((seg, idx) => [seg, idx]));
  const OTHER_AG = flowAgencies.length;
  const OTHER_CAT = flowCatSegs.length;
  const flowMatrix = Array.from({ length: flowAgencies.length + 1 }, () => new Array(flowCatSegs.length + 1).fill(0));
  for (const r of rows) {
    const ai = flowAgSet.has(r[AG]) ? flowAgSet.get(r[AG]) : OTHER_AG;
    const ci = r[SEG] && flowCatSet.has(r[SEG]) ? flowCatSet.get(r[SEG]) : OTHER_CAT;
    flowMatrix[ai][ci] += r[AMT];
  }
  const flow = {
    agencies: flowAgencies.map((a) => a.name).concat(['Other agencies']),
    categories: flowCatSegs.map((s) => segName.get(s) || s).concat(['Other categories']),
    links: [],
  };
  for (let ai = 0; ai < flowMatrix.length; ai++) {
    for (let ci = 0; ci < flowMatrix[ai].length; ci++) {
      if (flowMatrix[ai][ci] > 0) flow.links.push({ a: ai, c: ci, value: Math.round(flowMatrix[ai][ci]) });
    }
  }

  // ── Matrix (agency × category) ──
  const matAgencies = agRank.slice(0, MATRIX_AGENCIES);
  const matCatSegs = categories.slice(0, MATRIX_CATEGORIES).map((c) => c.seg);
  const matAgSet = new Map(matAgencies.map((a, idx) => [a.i, idx]));
  const matCatSet = new Map(matCatSegs.map((seg, idx) => [seg, idx]));
  const grid = matAgencies.map(() => new Array(matCatSegs.length).fill(0));
  for (const r of rows) {
    if (matAgSet.has(r[AG]) && r[SEG] && matCatSet.has(r[SEG])) {
      grid[matAgSet.get(r[AG])][matCatSet.get(r[SEG])] += r[AMT];
    }
  }
  const matrix = {
    agencies: matAgencies.map((a) => ({ name: a.name, slug: slug(a.name) })),
    categories: matCatSegs.map((s) => segName.get(s) || s),
    grid: grid.map((row) => row.map((v) => Math.round(v))),
  };

  // ── Monthly (chronological) ──
  const monthlyArr = Array.from(monthly.entries())
    .filter(([ym]) => ym !== 'unknown')
    .map(([ym, v]) => ({ ym, value: v.value, count: v.count }))
    .sort((a, b) => (a.ym < b.ym ? -1 : 1));

  // ── Findings / auto-detected insights ──
  const findings = [];
  const totalLimited = methodAgg[0].value;
  findings.push({
    severity: totalLimited / totalValue > 0.35 ? 'warn' : 'info',
    title: 'Share awarded without open competition',
    detail: `${Math.round((totalLimited / totalValue) * 100)}% of contract value ($${(totalLimited / 1e9).toFixed(1)}b) was awarded via limited (non-competitive) tender rather than open tender.`,
  });
  // Top supplier concentration
  const top10Sup = supRank.slice(0, 10).reduce((s, x) => s + x.value, 0);
  findings.push({
    severity: top10Sup / totalValue > 0.25 ? 'warn' : 'info',
    title: 'Supplier concentration',
    detail: `The 10 largest suppliers captured ${Math.round((top10Sup / totalValue) * 100)}% of all contract value. The single largest, ${supRank[0].name}, won $${(supRank[0].value / 1e9).toFixed(2)}b across ${supRank[0].count.toLocaleString()} contracts.`,
  });
  // Agencies most reliant on limited tender (min scale)
  const limitedAgencies = agRank
    .filter((a) => a.value > 5e7)
    .map((a) => ({ name: a.name, pct: a.limited / a.value, value: a.value }))
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3);
  for (const la of limitedAgencies) {
    if (la.pct > 0.6) {
      findings.push({
        severity: 'alert',
        title: `${la.name}: heavy reliance on limited tender`,
        detail: `${Math.round(la.pct * 100)}% of this agency's $${(la.value / 1e9).toFixed(2)}b was awarded via limited tender.`,
      });
    }
  }
  // Largest single contract
  let biggest = rows[0];
  for (const r of rows) if (r[AMT] > biggest[AMT]) biggest = r;
  findings.push({
    severity: 'info',
    title: 'Largest single contract',
    detail: `$${(biggest[AMT] / 1e9).toFixed(2)}b — ${agencies[biggest[AG]]} to ${suppliers[biggest[SUP]]}${biggest[DESC] ? ' for ' + biggest[DESC] : ''}.`,
  });
  // End-of-financial-year spike
  const juneKey = monthlyArr.find((m) => m.ym.endsWith('-06'));
  if (juneKey) {
    const avg = monthlyArr.reduce((s, m) => s + m.value, 0) / monthlyArr.length;
    if (juneKey.value > avg * 1.5) {
      findings.push({
        severity: 'warn',
        title: 'End-of-financial-year spending spike',
        detail: `June recorded $${(juneKey.value / 1e9).toFixed(1)}b in contracts — ${(juneKey.value / avg).toFixed(1)}× the monthly average, a classic "use it or lose it" budget pattern.`,
      });
    }
  }

  // ── Table payload: largest TABLE_CAP contracts, re-indexed compactly ──
  const sortedRows = rows.slice().sort((a, b) => b[AMT] - a[AMT]).slice(0, TABLE_CAP);
  const tSup = new Map(), tAg = new Map();
  const tIndex = (map, key) => { let i = map.get(key); if (i === undefined) { i = map.size; map.set(key, i); } return i; };
  const tableRows = sortedRows.map((r) => [
    tIndex(tSup, r[SUP]), tIndex(tAg, r[AG]), r[AMT], r[DATE], r[SEG], r[METHOD], r[STATE], r[DESC], r[CN],
  ]);
  const tableSuppliers = Array.from(tSup.keys()).map((i) => suppliers[i]);
  const tableAgencies = Array.from(tAg.keys()).map((i) => agencies[i]);
  const minTableAmt = sortedRows.length ? sortedRows[sortedRows.length - 1][AMT] : 0;

  const aggregates = {
    meta: {
      ...meta,
      totalValue: Math.round(totalValue),
      tableCap: TABLE_CAP,
      tableCount: tableRows.length,
      tableMinAmount: minTableAmt,
      tableIsCapped: rows.length > TABLE_CAP,
    },
    monthly: monthlyArr,
    methods: methods.map((label, i) => ({ code: i, label, value: methodAgg[i].value, count: methodAgg[i].count })),
    states: states.map((state, i) => ({ i, state, value: stateAgg[i].value, count: stateAgg[i].count })),
    categories,
    histogram: HIST_LABELS.map((label, i) => ({ label, count: hist[i].count, value: hist[i].value })),
    topSuppliers,
    topAgencies,
    network,
    flow,
    matrix,
    findings,
    segNames: segs,
  };

  const table = {
    suppliers: tableSuppliers,
    agencies: tableAgencies,
    states,
    methods,
    segs,
    rows: tableRows,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'aggregates.json'), JSON.stringify(aggregates));
  await writeFile(join(OUT_DIR, 'contracts.json'), JSON.stringify(table));
  console.log(
    `Wrote aggregates.json (${topAgencies.length} agencies, ${topSuppliers.length} top suppliers, ` +
      `${network.nodes.length} network nodes) and contracts.json (${tableRows.length} table rows).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
