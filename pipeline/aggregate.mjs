// Aggregate raw contract notices (pipeline/raw/contracts.ndjson) into compact
// JSON files under public/data/ that the browser app reads. No external deps.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENTS, CONSULTING_SEGMENTS, segmentOf, segmentName } from './unspsc.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = `${HERE}/raw/contracts.ndjson`;
const OUT = `${HERE}/../public/data`;

function slugify(s) {
  return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown';
}
function round(n) { return Math.round(n); }
function fy(dateStr) {
  // Australian financial year: Jul 1 – Jun 30. Returns e.g. "2024-25".
  const d = dateStr || '';
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (!y || !m) return 'unknown';
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

async function loadRaw() {
  const text = await readFile(RAW, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return rows;
}

// Deduplicate by ocid keeping the latest release (amendments supersede originals).
function dedupe(rows) {
  const byOcid = new Map();
  for (const r of rows) {
    if (!r.ocid) { byOcid.set(`no-ocid-${r.id}-${byOcid.size}`, r); continue; }
    const prev = byOcid.get(r.ocid);
    if (!prev || (r.date || '') > (prev.date || '')) byOcid.set(r.ocid, r);
  }
  return [...byOcid.values()];
}

function topN(map, n, mapper = (v) => v) {
  return [...map.entries()]
    .map(([k, v]) => mapper({ key: k, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

async function main() {
  const rawRows = await loadRaw();
  const rows = dedupe(rawRows).filter((r) => r.amount > 0);
  process.stdout.write(`Loaded ${rawRows.length} raw, ${rows.length} unique priced contracts\n`);
  await mkdir(OUT, { recursive: true });

  const dates = rows.map((r) => r.signed).filter(Boolean).sort();
  const periodStart = dates[0] || '';
  const periodEnd = dates[dates.length - 1] || '';

  // ---- Accumulators ----
  const suppliers = new Map(); // name -> agg
  const agencies = new Map();
  const categories = new Map(); // seg -> agg
  const monthly = new Map(); // YYYY-MM -> {total,count}
  const byFy = new Map(); // fy -> {total,count}
  const stateAgg = new Map(); // state -> {total,count}
  const methodAgg = new Map();

  // For network / flow / matrix
  const supAgencyPair = new Map(); // `${sup}|||${ag}` -> total
  const catAgencyPair = new Map(); // `${seg}|||${ag}` -> total

  let grandTotal = 0;

  for (const r of rows) {
    const seg = segmentOf(r.unspsc);
    const segName = SEGMENTS[seg] || 'Other / Unclassified';
    grandTotal += r.amount;

    // supplier
    let s = suppliers.get(r.supplier);
    if (!s) { s = { total: 0, count: 0, abn: r.abn, state: r.state, agencies: new Map(), cats: new Map(), months: new Map(), max: 0 }; suppliers.set(r.supplier, s); }
    s.total += r.amount; s.count += 1;
    if (!s.abn && r.abn) s.abn = r.abn;
    if (!s.state && r.state) s.state = r.state;
    if (r.amount > s.max) s.max = r.amount;
    s.agencies.set(r.agency, (s.agencies.get(r.agency) || 0) + r.amount);
    s.cats.set(seg, (s.cats.get(seg) || 0) + r.amount);
    if (r.signed) s.months.set(r.signed.slice(0, 7), (s.months.get(r.signed.slice(0, 7)) || 0) + r.amount);

    // agency
    let a = agencies.get(r.agency);
    if (!a) { a = { total: 0, count: 0, suppliers: new Map(), cats: new Map(), months: new Map(), methods: new Map() }; agencies.set(r.agency, a); }
    a.total += r.amount; a.count += 1;
    a.suppliers.set(r.supplier, (a.suppliers.get(r.supplier) || 0) + r.amount);
    a.cats.set(seg, (a.cats.get(seg) || 0) + r.amount);
    if (r.signed) a.months.set(r.signed.slice(0, 7), (a.months.get(r.signed.slice(0, 7)) || 0) + r.amount);
    if (r.method) a.methods.set(r.method, (a.methods.get(r.method) || 0) + r.amount);

    // category
    let c = categories.get(seg);
    if (!c) { c = { name: segName, total: 0, count: 0, suppliers: new Map(), agencies: new Map(), consulting: CONSULTING_SEGMENTS.has(seg) }; categories.set(seg, c); }
    c.total += r.amount; c.count += 1;
    c.suppliers.set(r.supplier, (c.suppliers.get(r.supplier) || 0) + r.amount);
    c.agencies.set(r.agency, (c.agencies.get(r.agency) || 0) + r.amount);

    // time
    if (r.signed) {
      const mo = r.signed.slice(0, 7);
      const mm = monthly.get(mo) || { total: 0, count: 0 };
      mm.total += r.amount; mm.count += 1; monthly.set(mo, mm);
      const f = fy(r.signed);
      const ff = byFy.get(f) || { total: 0, count: 0 };
      ff.total += r.amount; ff.count += 1; byFy.set(f, ff);
    }
    // state
    if (r.state) {
      const st = stateAgg.get(r.state) || { total: 0, count: 0 };
      st.total += r.amount; st.count += 1; stateAgg.set(r.state, st);
    }
    // method
    if (r.method) {
      const md = methodAgg.get(r.method) || { total: 0, count: 0 };
      md.total += r.amount; md.count += 1; methodAgg.set(r.method, md);
    }

    // pairs
    const spKey = `${r.supplier}|||${r.agency}`;
    supAgencyPair.set(spKey, (supAgencyPair.get(spKey) || 0) + r.amount);
    const caKey = `${seg}|||${r.agency}`;
    catAgencyPair.set(caKey, (catAgencyPair.get(caKey) || 0) + r.amount);
  }

  const mapTop = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, total]) => ({ name, total: round(total) }));

  // ---- suppliers.json (all, compact) ----
  const supplierList = [...suppliers.entries()].map(([name, s]) => {
    const topCat = [...s.cats.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      slug: slugify(name), name, abn: s.abn || '', state: s.state || '',
      total: round(s.total), count: s.count, agencies: s.agencies.size,
      cat: topCat ? topCat[0] : '99', avg: round(s.total / s.count), max: round(s.max),
    };
  }).sort((a, b) => b.total - a.total);

  // suppliers-detail.json: full breakdown for top 400 suppliers (drill-down)
  const supplierDetail = {};
  for (const sup of supplierList.slice(0, 400)) {
    const s = suppliers.get(sup.name);
    supplierDetail[sup.slug] = {
      name: sup.name, abn: sup.abn, state: sup.state,
      total: round(s.total), count: s.count, avg: round(s.total / s.count), max: round(s.max),
      agencies: mapTop(s.agencies, 12),
      cats: [...s.cats.entries()].sort((a, b) => b[1] - a[1]).map(([seg, total]) => ({ seg, name: SEGMENTS[seg] || 'Other', total: round(total) })),
      months: [...s.months.entries()].sort().map(([m, total]) => ({ m, total: round(total) })),
    };
  }

  // ---- agencies.json (all, with detail — few enough) ----
  const agencyList = [...agencies.entries()].map(([name, a]) => ({
    slug: slugify(name), name, total: round(a.total), count: a.count, avg: round(a.total / a.count),
    suppliers: a.suppliers.size,
    topSuppliers: mapTop(a.suppliers, 10),
    cats: [...a.cats.entries()].sort((x, y) => y[1] - x[1]).map(([seg, total]) => ({ seg, name: SEGMENTS[seg] || 'Other', total: round(total) })),
    months: [...a.months.entries()].sort().map(([m, total]) => ({ m, total: round(total) })),
    methods: mapTop(a.methods, 6),
  })).sort((a, b) => b.total - a.total);

  // ---- categories.json ----
  const categoryList = [...categories.entries()].map(([seg, c]) => ({
    seg, name: c.name, total: round(c.total), count: c.count, consulting: c.consulting,
    topSuppliers: mapTop(c.suppliers, 12),
    topAgencies: mapTop(c.agencies, 12),
  })).sort((a, b) => b.total - a.total);

  // ---- monthly.json ----
  const monthlyList = [...monthly.entries()].sort().map(([m, v]) => ({ m, total: round(v.total), count: v.count }));
  const fyList = [...byFy.entries()].sort().map(([f, v]) => ({ fy: f, total: round(v.total), count: v.count }));

  // ---- largest.json (top 1000 individual contracts) ----
  const largest = [...rows].sort((a, b) => b.amount - a.amount).slice(0, 1000).map((r) => ({
    id: r.id, title: r.title, amount: round(r.amount), supplier: r.supplier, agency: r.agency,
    seg: segmentOf(r.unspsc), cat: segmentName(r.unspsc), signed: r.signed, method: r.method,
    pStart: r.pStart, pEnd: r.pEnd, state: r.state,
  }));

  // ---- network.json (top suppliers + top agencies + edges) ----
  const topSupNames = new Set(supplierList.slice(0, 45).map((s) => s.name));
  const topAgNames = new Set(agencyList.slice(0, 30).map((a) => a.name));
  const edges = [];
  for (const [key, total] of supAgencyPair.entries()) {
    const [sup, ag] = key.split('|||');
    if (topSupNames.has(sup) && topAgNames.has(ag)) edges.push({ s: sup, a: ag, total: round(total) });
  }
  edges.sort((a, b) => b.total - a.total);
  const network = {
    suppliers: supplierList.slice(0, 45).map((s) => ({ name: s.name, total: s.total, cat: s.cat })),
    agencies: agencyList.slice(0, 30).map((a) => ({ name: a.name, total: a.total })),
    edges: edges.slice(0, 400),
  };

  // ---- flows.json (category -> agency, top agencies) ----
  const flowAgNames = agencyList.slice(0, 12).map((a) => a.name);
  const flowAgSet = new Set(flowAgNames);
  const flowMap = new Map(); // seg -> agency -> total
  for (const [key, total] of catAgencyPair.entries()) {
    const [seg, ag] = key.split('|||');
    if (!flowAgSet.has(ag)) continue;
    if (!flowMap.has(seg)) flowMap.set(seg, new Map());
    flowMap.get(seg).set(ag, total);
  }
  const flowSegs = categoryList.slice(0, 10).map((c) => c.seg);
  const flows = {
    segments: flowSegs.map((seg) => ({ seg, name: SEGMENTS[seg] || 'Other', total: categories.get(seg) ? round(categories.get(seg).total) : 0 })),
    agencies: flowAgNames.map((name) => ({ name, total: round(agencies.get(name).total) })),
    links: [],
  };
  for (const seg of flowSegs) {
    const am = flowMap.get(seg);
    if (!am) continue;
    for (const ag of flowAgNames) {
      const t = am.get(ag);
      if (t) flows.links.push({ seg, agency: ag, total: round(t) });
    }
  }

  // ---- matrix.json (top agencies x top category segments) ----
  const mxAgencies = agencyList.slice(0, 18);
  const mxSegs = categoryList.slice(0, 12).map((c) => ({ seg: c.seg, name: c.name }));
  const matrix = {
    agencies: mxAgencies.map((a) => ({ name: a.name, slug: a.slug, total: a.total })),
    segments: mxSegs,
    cells: mxAgencies.map((a) => {
      const agg = agencies.get(a.name);
      return mxSegs.map((s) => round(agg.cats.get(s.seg) || 0));
    }),
  };

  // ---- consulting.json ----
  const consultingSuppliers = new Map();
  const consultingByFy = new Map();
  let consultingTotal = 0;
  for (const r of rows) {
    const seg = segmentOf(r.unspsc);
    if (!CONSULTING_SEGMENTS.has(seg)) continue;
    consultingTotal += r.amount;
    consultingSuppliers.set(r.supplier, (consultingSuppliers.get(r.supplier) || 0) + r.amount);
    const f = fy(r.signed);
    consultingByFy.set(f, (consultingByFy.get(f) || 0) + r.amount);
  }
  // Well-known consulting / professional-services & major IT-services firms.
  // Matched with word boundaries and aggregated to a canonical label across ALL
  // contracts (a firm's government work is not confined to the "consulting" segments).
  const FIRM_PATTERNS = [
    { label: 'Accenture', re: /\baccenture\b/i },
    { label: 'Deloitte', re: /\bdeloitte\b/i },
    { label: 'PwC', re: /pricewaterhousecoopers|\bpwc\b/i },
    { label: 'KPMG', re: /\bkpmg\b/i },
    { label: 'EY (Ernst & Young)', re: /ernst\s*&?\s*young|\bey\b/i },
    { label: 'McKinsey & Company', re: /mckinsey/i },
    { label: 'Boston Consulting Group', re: /boston consulting|\bbcg\b/i },
    { label: 'IBM', re: /\bibm\b/i },
    { label: 'DXC Technology', re: /\bdxc\b/i },
    { label: 'Capgemini', re: /capgemini/i },
    { label: 'Infosys', re: /infosys/i },
    { label: 'Nous Group', re: /\bnous\b/i },
    { label: 'Synergy Group', re: /synergy group/i },
    { label: 'KordaMentha', re: /korda\s*mentha/i },
    { label: 'Protiviti', re: /protiviti/i },
    { label: 'Oakton', re: /\boakton\b/i },
  ];
  const firmAgg = new Map(); // label -> {total, count}
  for (const r of rows) {
    const pat = FIRM_PATTERNS.find((p) => p.re.test(r.supplier));
    if (!pat) continue;
    const a = firmAgg.get(pat.label) || { total: 0, count: 0 };
    a.total += r.amount; a.count += 1; firmAgg.set(pat.label, a);
  }
  const consulting = {
    total: round(consultingTotal),
    share: grandTotal ? consultingTotal / grandTotal : 0,
    byFy: [...consultingByFy.entries()].sort().map(([f, t]) => ({ fy: f, total: round(t) })),
    topSuppliers: [...consultingSuppliers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, total]) => ({ name, slug: slugify(name), total: round(total) })),
    bigFirms: [...firmAgg.entries()].sort((a, b) => b[1].total - a[1].total).map(([name, v]) => ({ name, total: round(v.total), count: v.count })),
    segments: categoryList.filter((c) => c.consulting).map((c) => ({ seg: c.seg, name: c.name, total: c.total })),
  };

  // ---- insights.json (auto anomalies) ----
  const insights = [];
  const medianAgencyContract = (() => {
    const vals = agencyList.map((a) => a.avg).sort((x, y) => x - y);
    return vals[Math.floor(vals.length / 2)] || 0;
  })();
  // Agencies dominated by a single supplier
  for (const a of agencyList.slice(0, 40)) {
    const top = a.topSuppliers[0];
    if (top && a.total > 20_000_000 && top.total / a.total > 0.5) {
      insights.push({ severity: 'warn', kind: 'concentration', title: `${a.name}: one supplier holds ${Math.round(top.total / a.total * 100)}% of spend`, detail: `${top.name} accounts for $${(top.total / 1e6).toFixed(1)}M of ${a.name}'s $${(a.total / 1e6).toFixed(1)}M.`, agency: a.slug });
    }
  }
  // Suppliers far above median size
  for (const s of supplierList.slice(0, 25)) {
    if (s.total > 500_000_000) {
      insights.push({ severity: 'info', kind: 'megasupplier', title: `${s.name} won $${(s.total / 1e9).toFixed(2)}B across ${s.count.toLocaleString()} contracts`, detail: `Average contract $${(s.avg / 1e6).toFixed(1)}M, spanning ${s.agencies} agencies.`, supplier: s.slug });
    }
  }
  // Category YoY shift (needs two FYs)
  if (fyList.length >= 2) {
    const [prev, cur] = fyList.slice(-2);
    const catFy = new Map(); // seg -> {prev,cur}
    for (const r of rows) {
      const f = fy(r.signed); const seg = segmentOf(r.unspsc);
      if (f !== prev.fy && f !== cur.fy) continue;
      const rec = catFy.get(seg) || { prev: 0, cur: 0 };
      rec[f === prev.fy ? 'prev' : 'cur'] += r.amount; catFy.set(seg, rec);
    }
    for (const [seg, v] of catFy.entries()) {
      if (v.prev > 50_000_000 && v.cur > 50_000_000) {
        const chg = (v.cur - v.prev) / v.prev;
        if (Math.abs(chg) > 0.4) {
          insights.push({ severity: chg > 0 ? 'info' : 'warn', kind: 'trend', title: `${SEGMENTS[seg] || 'Category'} spend ${chg > 0 ? 'rose' : 'fell'} ${Math.round(Math.abs(chg) * 100)}% (${prev.fy}→${cur.fy})`, detail: `$${(v.prev / 1e6).toFixed(0)}M → $${(v.cur / 1e6).toFixed(0)}M.` });
        }
      }
    }
  }
  // Consulting share callout
  insights.unshift({ severity: 'info', kind: 'consulting', title: `Professional & consulting services: $${(consultingTotal / 1e9).toFixed(2)}B (${(consulting.share * 100).toFixed(1)}% of all spend)`, detail: `Across the ${fyList.length >= 2 ? 'two financial years' : 'period'} covered.` });
  insights.sort((a, b) => ({ alert: 0, warn: 1, info: 2 }[a.severity] - { alert: 0, warn: 1, info: 2 }[b.severity]));

  // ---- meta.json ----
  const meta = {
    generated: new Date().toISOString().slice(0, 10),
    periodStart, periodEnd,
    totalValue: round(grandTotal),
    totalContracts: rows.length,
    supplierCount: suppliers.size,
    agencyCount: agencies.size,
    categoryCount: categories.size,
    consultingTotal: round(consultingTotal),
    consultingShare: consulting.share,
    fyList, methods: mapTop(methodAgg, 8),
    states: [...stateAgg.entries()].map(([state, v]) => ({ state, total: round(v.total), count: v.count })).sort((a, b) => b.total - a.total),
  };

  const files = {
    'meta.json': meta,
    'suppliers.json': supplierList,
    'suppliers-detail.json': supplierDetail,
    'agencies.json': agencyList,
    'categories.json': categoryList,
    'monthly.json': monthlyList,
    'largest.json': largest,
    'network.json': network,
    'flows.json': flows,
    'matrix.json': matrix,
    'consulting.json': consulting,
    'insights.json': insights,
  };
  for (const [fn, data] of Object.entries(files)) {
    await writeFile(`${OUT}/${fn}`, JSON.stringify(data));
    const bytes = Buffer.byteLength(JSON.stringify(data));
    process.stdout.write(`  ${fn}: ${(bytes / 1024).toFixed(0)} KB\n`);
  }
  process.stdout.write(`\nTotal value $${(grandTotal / 1e9).toFixed(2)}B across ${rows.length} contracts, ${suppliers.size} suppliers, ${agencies.size} agencies.\n`);
  process.stdout.write(`Period: ${periodStart} → ${periodEnd}\n`);
}

main().catch((e) => { console.error('aggregate failed:', e); process.exit(1); });
