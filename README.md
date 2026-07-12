# Government Contracts (AU)

**Follow the public money — every Australian Government contract, ranked by supplier, agency and category.**

🔗 **Live:** [https://au-contracts.benrichardson.dev](https://au-contracts.benrichardson.dev)

## What is this?

Government Contracts (AU) turns the Australian Government's open procurement data into a fast, searchable dashboard. Every Commonwealth entity is legally required to publish the contracts it awards on [AusTender](https://www.tenders.gov.au/), but AusTender's own search offers no aggregation, leaderboards or visual analysis. This site fills that gap.

It ingests **~166,000 contract notices** covering two full financial years (2023‑24 and 2024‑25), de‑duplicates amendments down to **121,000 unique contracts worth $126.8 billion**, and lets you instantly answer the questions people actually ask: which suppliers win the most public money, which agencies spend the most, where the money for professional and consulting services goes, and what the biggest single contracts are.

The professional & consulting view is particularly topical — it tracks the major firms (Accenture, IBM, Deloitte, KPMG, EY, DXC and others) and makes visible things like PwC's near‑total collapse in Commonwealth work following the 2023 tax‑leaks scandal.

## Who is this for?

Journalists on deadline, policy researchers, opposition and crossbench staffers, procurement and bid managers, and any taxpayer who wants to see where their money goes. It's desktop‑first and dense, but every piece of jargon has an inline definition and a full glossary, so no prior knowledge of government procurement is assumed.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [AusTender OCDS API](https://api.tenders.gov.au/) | Every Commonwealth contract notice: supplier (name, ABN, state), buying agency, value, UNSPSC category, procurement method, dates | Continuous (weekly reporting window) |
| UNSPSC segment map (embedded) | Maps 8‑digit UNSPSC codes to readable top‑level categories | Static |

Data is published by the Department of Finance under CC BY 3.0 AU.

## Features

- **Supplier & agency leaderboards** — every supplier (34,000+) and agency (131) ranked by value, count, average and reach; searchable and sortable.
- **Category breakdown** — spend by UNSPSC category as bars, a table and a treemap.
- **Professional & consulting focus** — carve‑out of consulting‑type spend with a canonical big‑firm ranking and financial‑year trend.
- **Biggest contracts** — the 1,000 largest individual contracts, filterable by procurement method.
- **Supplier ↔ agency network graph** — a hand‑rolled force simulation showing who sells to whom.
- **Category → agency Sankey flow** — where each category of spend lands.
- **Agency × category matrix heatmap** — concentration at a glance.
- **Monthly trend** — value over time, including the June end‑of‑financial‑year spike.
- **Supplier‑state map** — a Leaflet map of registered supplier locations.
- **Auto‑detected findings** — single‑supplier‑dominated agencies, mega‑suppliers, and big year‑on‑year category shifts.
- **Drill‑downs** — click any supplier or agency for a full breakdown, linkable via URL hash.

## Tech Stack

- **Runtime:** Vanilla TypeScript (no framework)
- **Build:** Vite 6
- **Testing:** Vitest (71 tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline → pre‑computed JSON
- **Maps:** Leaflet
- **Charts:** hand‑rolled SVG (bars, treemap, network, Sankey, matrix, line) — no chart library

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview

# Refresh the data (collect + aggregate)
MONTHS=24 END=2025-06-30 npm run collect
npm run aggregate
```

## How it works

`pipeline/collect.mjs` pages through the AusTender OCDS API month by month (concurrently) and writes a minimal record per contract to NDJSON. `pipeline/aggregate.mjs` de‑duplicates by OCID (keeping the latest amendment), then rolls the data up into compact JSON files in `public/data/` — supplier/agency/category aggregates, monthly and financial‑year series, the 1,000 biggest contracts, and pre‑computed network/flow/matrix structures. The browser app fetches only these aggregates, so it stays fast despite the underlying dataset being large. A scheduled GitHub Actions workflow re‑runs the pipeline and commits refreshed data.

## License

MIT
