// Collect Australian Government contract notices from the AusTender OCDS API.
// Writes minimal per-contract records as NDJSON to pipeline/raw/contracts.ndjson.
// No external dependencies — uses Node 20+ global fetch.
//
// Env:
//   MONTHS   number of trailing months to collect (default 24)
//   END      end date YYYY-MM-DD (default: last day of previous month, UTC)
//   CONCURRENCY  parallel month-windows (default 6)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = `${HERE}/raw/contracts.ndjson`;
const API = 'https://api.tenders.gov.au/ocds/findByDates/contractPublished';
const UA = { 'User-Agent': 'au-contracts-pipeline/1.0 (benrichardson.dev)' };

const MONTHS = Number(process.env.MONTHS || 24);
const CONCURRENCY = Number(process.env.CONCURRENCY || 6);

// AusTender OCDS rejects millisecond precision — emit seconds + 'Z'.
function iso(d) { return d.toISOString().slice(0, 19) + 'Z'; }

// Build a list of [startISO, endISO] month windows covering the last MONTHS months.
function monthWindows(months, endDate) {
  const wins = [];
  // Anchor to first day of the month of endDate, walk backwards.
  let y = endDate.getUTCFullYear();
  let m = endDate.getUTCMonth(); // 0-based; window is this month
  for (let i = 0; i < months; i++) {
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59)); // last day of month
    wins.push([iso(start), iso(end)]);
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return wins;
}

async function fetchJson(url, tries = 5) {
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * (t + 1)));
    }
  }
  throw lastErr;
}

const AMEND = /-A\d+$/i;

function extract(release) {
  const contract = (release.contracts || [])[0];
  if (!contract) return null;
  const parties = release.parties || [];
  const supplier = parties.find((p) => (p.roles || []).includes('supplier')) || {};
  const buyer = parties.find((p) => (p.roles || []).includes('procuringEntity')) || {};
  const abn = (supplier.additionalIdentifiers || []).find((x) => x.scheme === 'AU-ABN');
  const item = (contract.items || [])[0] || {};
  const unspsc = item.classification && item.classification.id ? String(item.classification.id) : '';
  const amount = Number(contract.value && contract.value.amount) || 0;
  return {
    ocid: release.ocid,
    id: contract.id,
    title: (contract.title || contract.description || '').slice(0, 240),
    amount,
    signed: (contract.dateSigned || release.date || '').slice(0, 10),
    date: release.date || '',
    supplier: (supplier.name || 'Unknown').trim(),
    abn: abn ? abn.id : '',
    state: (supplier.address && supplier.address.region) || '',
    agency: (buyer.name || 'Unknown').trim(),
    unspsc,
    method: (release.tender && release.tender.procurementMethodDetails) || '',
    pStart: (contract.period && contract.period.startDate || '').slice(0, 10),
    pEnd: (contract.period && contract.period.endDate || '').slice(0, 10),
    amendment: AMEND.test(contract.id || ''),
  };
}

async function collectWindow([start, end], onBatch) {
  let url = `${API}/${start}/${end}`;
  let pages = 0;
  let count = 0;
  while (url) {
    const j = await fetchJson(url);
    const rows = (j.releases || []).map(extract).filter(Boolean);
    count += rows.length;
    await onBatch(rows);
    pages += 1;
    url = j.links && j.links.next ? j.links.next : null;
    if (pages > 5000) break; // hard safety
  }
  return { count, pages };
}

async function runPool(tasks, concurrency) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      results[my] = await tasks[my]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

async function main() {
  const endDate = process.env.END
    ? new Date(`${process.env.END}T23:59:59Z`)
    : (() => {
        const now = new Date();
        // last day of previous month
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59));
      })();

  const windows = monthWindows(MONTHS, endDate);
  await mkdir(dirname(OUT), { recursive: true });

  const chunks = [];
  let total = 0;
  const label = (w) => w[0].slice(0, 7);

  const tasks = windows.map((w) => async () => {
    const local = [];
    const res = await collectWindow(w, async (rows) => { local.push(...rows); });
    total += res.count;
    process.stdout.write(`  ${label(w)}: ${res.count} contracts (${res.pages} pages) — running total ${total}\n`);
    chunks.push(...local);
    return res;
  });

  process.stdout.write(`Collecting ${MONTHS} months ending ${iso(endDate).slice(0, 10)} — ${windows.length} windows, concurrency ${CONCURRENCY}\n`);
  await runPool(tasks, CONCURRENCY);

  const ndjson = chunks.map((r) => JSON.stringify(r)).join('\n');
  await writeFile(OUT, ndjson);
  process.stdout.write(`\nWrote ${chunks.length} records to ${OUT}\n`);
}

main().catch((e) => { console.error('collect failed:', e); process.exit(1); });
