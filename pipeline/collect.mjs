// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// AusTender / OCDS contract-notice collector.
//
// Fetches every Commonwealth contract notice published in a financial year
// directly from the authoritative live AusTender Open Contracting (OCDS) API,
// extracts one compact row per contract, and writes an intermediate
// `pipeline/raw.json` that aggregate.mjs turns into the browser payloads.
//
// No external dependencies — uses Node built-ins (global fetch, fs).
// Run: node pipeline/collect.mjs   (optionally FY_START=2025 to override year)

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_PATH = join(__dirname, 'raw.json');

// UNSPSC segment (first two digits of the 8-digit classification) → plain-English name.
export const UNSPSC_SEGMENTS = {
  '10': 'Live Plant & Animal Material',
  '11': 'Mineral, Textile & Inedible Materials',
  '12': 'Chemicals & Gas Materials',
  '13': 'Resin, Rubber, Foam & Film',
  '14': 'Paper Materials & Products',
  '15': 'Fuels, Lubricants & Anti-corrosives',
  '20': 'Mining & Well-drilling Machinery',
  '21': 'Farming, Fishing & Forestry Machinery',
  '22': 'Building & Construction Machinery',
  '23': 'Industrial Manufacturing Machinery',
  '24': 'Material Handling & Storage Machinery',
  '25': 'Vehicles & Components',
  '26': 'Power Generation & Distribution',
  '27': 'Tools & General Machinery',
  '30': 'Structural & Construction Components',
  '31': 'Manufacturing Components & Supplies',
  '32': 'Electronic Components & Supplies',
  '39': 'Electrical Systems & Lighting',
  '40': 'Distribution & Conditioning Systems',
  '41': 'Laboratory & Measuring Equipment',
  '42': 'Medical Equipment & Supplies',
  '43': 'Information Technology & Telecoms',
  '44': 'Office Equipment & Supplies',
  '45': 'Printing, Photographic & AV Equipment',
  '46': 'Defence, Security & Safety Equipment',
  '47': 'Cleaning Equipment & Supplies',
  '48': 'Service Industry Machinery',
  '49': 'Sports & Recreational Equipment',
  '50': 'Food, Beverage & Tobacco',
  '51': 'Drugs & Pharmaceuticals',
  '52': 'Domestic Appliances & Electronics',
  '53': 'Apparel, Luggage & Personal Care',
  '54': 'Timepieces, Jewelry & Gemstones',
  '55': 'Published Products',
  '56': 'Furniture & Furnishings',
  '60': 'Musical, Games, Arts & Educational',
  '64': 'Financial Instruments & Agreements',
  '70': 'Farming & Forestry Services',
  '71': 'Mining, Oil & Gas Services',
  '72': 'Building & Facility Construction Services',
  '73': 'Industrial Production Services',
  '76': 'Industrial Cleaning Services',
  '77': 'Environmental Services',
  '78': 'Transportation, Storage & Mail Services',
  '80': 'Management & Business Professional Services',
  '81': 'Engineering & Research Services',
  '82': 'Editorial, Design & Media Services',
  '83': 'Public Utilities & Public Sector Services',
  '84': 'Financial & Insurance Services',
  '85': 'Healthcare Services',
  '86': 'Education & Training Services',
  '90': 'Travel, Food, Lodging & Entertainment',
  '91': 'Personal & Domestic Services',
  '92': 'Defence & Public Order Services',
  '93': 'Politics & Civic Affairs Services',
  '94': 'Organizations & Clubs',
  '95': 'Land, Buildings & Thoroughfares',
};

export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'Overseas', 'Unknown'];
export const METHODS = ['Limited tender', 'Open tender', 'Prequalified tender', 'Other'];

export function stateIndex(region) {
  if (!region) return STATES.indexOf('Unknown');
  const r = String(region).toUpperCase().trim();
  if (r.includes('OUTSIDE AUSTRALIA') || r.includes('OVERSEAS') || r.includes('FOREIGN')) {
    return STATES.indexOf('Overseas');
  }
  const map = {
    'NEW SOUTH WALES': 'NSW', VICTORIA: 'VIC', QUEENSLAND: 'QLD',
    'WESTERN AUSTRALIA': 'WA', 'SOUTH AUSTRALIA': 'SA', TASMANIA: 'TAS',
    'AUSTRALIAN CAPITAL TERRITORY': 'ACT', 'NORTHERN TERRITORY': 'NT',
  };
  const norm = map[r] || r;
  const idx = STATES.indexOf(norm);
  return idx >= 0 ? idx : STATES.indexOf('Unknown');
}

export function methodCode(details, method) {
  const d = (details || method || '').toLowerCase();
  if (d.includes('open')) return 1;
  if (d.includes('prequalified') || d.includes('multi')) return 2;
  if (d.includes('limited') || d.includes('direct') || d.includes('sole')) return 0;
  return 3; // other / unknown
}

export function trimDesc(s) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > 120 ? t.slice(0, 119) + '…' : t;
}

export function segFromContract(contract) {
  const items = contract.items || [];
  for (const it of items) {
    const id = it.classification && it.classification.id;
    if (id && String(id).length >= 2) {
      const seg = String(id).slice(0, 2);
      if (UNSPSC_SEGMENTS[seg]) return seg;
    }
  }
  return null;
}

// Extract compact contract rows from an OCDS release. Pure — exported for tests.
export function extractRows(rel, ctx) {
  const { supDict, agDict, usedSegs, dictIndex } = ctx;
  const out = [];
  const partyById = new Map();
  let agencyName = null;
  for (const p of rel.parties || []) {
    partyById.set(p.id, p);
    if ((p.roles || []).includes('procuringEntity') && !agencyName) agencyName = p.name;
  }
  const awardSupplier = new Map();
  for (const aw of rel.awards || []) {
    const s = (aw.suppliers || [])[0];
    if (s) awardSupplier.set(aw.id, s);
  }
  const method = methodCode(
    rel.tender && rel.tender.procurementMethodDetails,
    rel.tender && rel.tender.procurementMethod
  );
  for (const c of rel.contracts || []) {
    const amount = c.value && c.value.amount != null ? parseFloat(c.value.amount) : NaN;
    if (!isFinite(amount) || amount <= 0) continue;
    const aw = awardSupplier.get(c.awardID);
    const supplier = aw ? aw.name : null;
    if (!supplier || !agencyName) continue;
    const sp = aw ? partyById.get(aw.id) : null;
    const region = sp && sp.address ? sp.address.region : null;
    const rawDate = c.dateSigned || (c.period && c.period.startDate) || rel.date || '';
    const date = rawDate ? String(rawDate).slice(0, 10) : '';
    const seg = segFromContract(c);
    if (seg) usedSegs.add(seg);
    out.push([
      dictIndex(supDict, supplier),
      dictIndex(agDict, agencyName),
      Math.round(amount),
      date,
      seg || '',
      method,
      stateIndex(region),
      trimDesc(c.description || c.title),
      String(c.id || '').slice(0, 20),
    ]);
  }
  return out;
}

const API = (from, to, cursor) => {
  const base = `https://api.tenders.gov.au/ocds/findByDates/contractPublished/${from}T00:00:00Z/${to}T23:59:59Z`;
  return cursor ? `${base}?cursor=${cursor}` : base;
};

async function fetchJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'au-contracts/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

// Page through one date range, calling onRelease for every release.
async function collectRange(from, to, onRelease) {
  let url = API(from, to);
  let pages = 0;
  while (url && pages < 2000) {
    const d = await fetchJson(url);
    const rel = d.releases || [];
    for (const r of rel) onRelease(r);
    pages++;
    const next = d.links && d.links.next;
    if (!next || rel.length === 0) break;
    url = next;
  }
  return pages;
}

// Financial-year month boundaries (1 Jul .. 30 Jun).
function fyMonths(fyStart) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const y = m < 6 ? fyStart : fyStart + 1;
    const mm = ((m + 6) % 12) + 1; // Jul=7..Dec=12, Jan=1..Jun=6
    const from = `${y}-${String(mm).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate();
    const to = `${y}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    months.push([from, to]);
  }
  return months;
}

async function pool(items, size, worker) {
  const results = [];
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

async function main() {
  // Most recent complete financial year unless overridden.
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1; // 1-12
  // If we are in Jul..Dec, the last complete FY started (y-1); Jan..Jun → (y-2).
  const defaultFyStart = m >= 7 ? y - 1 : y - 2;
  const fyStart = process.env.FY_START ? parseInt(process.env.FY_START, 10) : defaultFyStart;
  const label = `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;

  const supDict = new Map();
  const agDict = new Map();
  const usedSegs = new Set();
  const dictIndex = (map, name) => {
    let idx = map.get(name);
    if (idx === undefined) {
      idx = map.size;
      map.set(name, idx);
    }
    return idx;
  };
  const ctx = { supDict, agDict, usedSegs, dictIndex };

  const rows = [];
  const months = fyMonths(fyStart);
  console.log(`Collecting ${label} (${months[0][0]} → ${months[11][1]}) from live AusTender OCDS API…`);

  await pool(months, 4, async ([from, to]) => {
    let n = 0;
    const pages = await collectRange(from, to, (rel) => {
      for (const row of extractRows(rel, ctx)) {
        rows.push(row);
        n++;
      }
    });
    console.log(`  ${from.slice(0, 7)}: ${n} contracts (${pages} pages)`);
  });

  if (rows.length === 0) {
    throw new Error('No contract rows collected — aborting so we do not overwrite good data.');
  }

  let totalValue = 0;
  let minDate = '9999-99-99';
  let maxDate = '0000-00-00';
  for (const r of rows) {
    totalValue += r[2];
    const d = r[3];
    if (d) {
      if (d < minDate) minDate = d;
      if (d > maxDate) maxDate = d;
    }
  }

  const payload = {
    meta: {
      generated: now.toISOString(),
      fyLabel: label,
      fyStart,
      windowFrom: months[0][0],
      windowTo: months[11][1],
      minDate,
      maxDate,
      count: rows.length,
      totalValue: Math.round(totalValue),
      supplierCount: supDict.size,
      agencyCount: agDict.size,
      states: STATES,
      methods: METHODS,
      source: 'AusTender Contract Notices — live Open Contracting (OCDS) API, tenders.gov.au',
    },
    suppliers: Array.from(supDict.keys()),
    agencies: Array.from(agDict.keys()),
    segs: Array.from(usedSegs).sort().map((s) => [s, UNSPSC_SEGMENTS[s]]),
    rows,
  };

  await mkdir(dirname(RAW_PATH), { recursive: true });
  await writeFile(RAW_PATH, JSON.stringify(payload));
  console.log(
    `Wrote raw.json: ${rows.length} contracts, ${supDict.size} suppliers, ` +
      `${agDict.size} agencies, $${(totalValue / 1e9).toFixed(1)}B (${label}).`
  );
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('collect.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
