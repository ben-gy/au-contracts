# Government Contracts (AU)

**Follow the money — every Australian federal government contract, who won it, which agency paid, and what for.**

🔗 **Live:** [https://au-contracts.benrichardson.dev](https://au-contracts.benrichardson.dev)

## What is this?

Every year the Australian Government awards tens of thousands of contracts worth well over a hundred billion dollars. Agencies are required to publish each one as a *contract notice* on **AusTender**, the Commonwealth's procurement portal. But AusTender's own search is one-record-at-a-time and has no aggregation — it's almost impossible to answer simple questions like "who are the biggest government suppliers?" or "how much is awarded without open competition?".

This site takes the entire AusTender dataset (published in the international **Open Contracting Data Standard**) and turns it into a fast, bookmarkable dashboard: supplier and agency leaderboards, a supplier↔agency relationship map, a spend-flow diagram, an agency × category matrix, a per-state choropleth, monthly trends, an automatically-detected "notable contracts" feed, and a searchable database of individual contracts.

The current build covers the **FY2025-26** financial year: ~66,000 contracts, ~20,600 suppliers and 128 agencies, totalling roughly $118 billion.

## Who is this for?

Journalists chasing procurement stories, policy and budget analysts comparing agency spending patterns, businesses researching who currently supplies a given agency before they bid, and citizens who read a headline about "$X billion in consultants" and want to see the numbers behind it. Heavy inline education (glossary tooltips + an About panel) means you don't need to know what "UNSPSC" or "limited tender" means to use it.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| [AusTender Open Contracting (OCDS) API](https://www.tenders.gov.au/) | Every published Commonwealth contract notice: supplier, procuring agency, value (AUD), signing dates, UNSPSC category, procurement method, supplier region | Continuously; this site re-collects quarterly |

## Features

- **Overview** — headline totals, auto-detected findings, biggest suppliers, monthly spend.
- **Supplier & agency leaderboards** — ranked by value, with contract counts, averages, partner counts and limited-tender share. Click any entity to drill in.
- **Contract database** — searchable, filterable, virtualised table of the largest contracts (with a disclosed inclusion threshold).
- **Relationship network** — force-directed bipartite graph of top suppliers ↔ agencies.
- **Spend flow** — Sankey diagram of value flowing from agencies to procurement categories.
- **Agency × category matrix** — heatmap revealing where each agency concentrates spend.
- **State map** — Leaflet choropleth of supplier value by state/territory.
- **Trends** — monthly spending with the end-of-financial-year spike, plus method breakdown.
- **Insights** — auto-detected anomalies (limited-tender reliance, supplier concentration, mega-deals) and a value-distribution histogram.
- **Drill-down drawer** — click any supplier or agency for its full profile and largest contracts.

## Tech Stack

- **Runtime:** Vanilla TypeScript (no framework)
- **Build:** Vite 6
- **Testing:** Vitest (49 tests)
- **Maps:** Leaflet + ABS-derived state GeoJSON
- **Visualisations:** hand-rolled SVG (bars, treemap, Sankey, force-directed network, heatmap, histogram) — no chart libraries
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline → compact JSON in `public/data/`

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
```

## How it works

A GitHub Actions pipeline runs quarterly:

1. `pipeline/collect.mjs` pages through the live AusTender OCDS API for the most recent complete financial year, extracting one compact row per contract into `pipeline/raw.json`.
2. `pipeline/aggregate.mjs` reads that file and precomputes every dashboard view over **all** contracts — leaderboards, network, flow, matrix, monthly series, histogram and insights — writing a small `aggregates.json`. It also writes `contracts.json`, the largest contracts for the searchable table, with a disclosed minimum-value threshold so nothing is silently hidden.

The browser loads `aggregates.json` for an instant paint of every summary view, and lazy-loads `contracts.json` only when the Contracts tab is opened. All views are hand-rendered to SVG/DOM for a dependency-light, desktop-app feel.

## license

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see
[ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

In short: you may run, modify, redistribute and even sell this, but if you
distribute it — or run a modified version where other people can reach it — you
have to publish your source under the same licence and keep the attribution. A
separate commercial licence without those obligations is available on request:
<hi@ben.gy>.

Third-party components keep their own licences — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
