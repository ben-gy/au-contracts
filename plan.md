# Site Plan: Government Contracts (AU)

## Overview
- **Name:** Government Contracts (AU)
- **Repo name:** au-contracts
- **Tagline:** Follow the money — every Australian federal government contract, who won it, which agency paid, and what for.

### Naming Convention
Country-specific → "Government Contracts (AU)" (ISO code in brackets).

## Target Audience
Journalists, researchers, procurement/policy analysts, competitors bidding for
government work, and engaged citizens who want to see where Commonwealth money
goes. Primarily desktop users doing investigative, comparative work — but the
site must also read well for a curious member of the public who has never heard
of "AusTender" or "UNSPSC".

## Value Proposition
AusTender's own search is clunky, one-record-at-a-time, and has no aggregation.
This site pre-aggregates the entire Open Contracting dataset into leaderboards,
a supplier↔agency relationship map, agency×category matrix, spend-flow diagram,
per-state map, monthly trend, and an auto-detected "notable contracts" feed —
answering questions AusTender can't: *Who are the biggest government suppliers?
Which agencies spend the most on consultants? What share is awarded via limited
(non-competitive) tender?* All in one fast, bookmarkable dashboard.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| AusTender Contract Notices (OCDS) via OCP Data Registry | https://data.open-contracting.org/en/publication/19 | Every published Commonwealth contract notice: supplier, procuring agency, value (AUD), dates, UNSPSC category, procurement method, supplier region | Yearly bulk files, updated regularly | No (open bulk download) |
| UNSPSC segment codeset | embedded | Maps 8-digit UNSPSC classification → human category name | Static | No |

## Key Features
1. **Supplier & agency leaderboards** — ranked by total contract value, with contract counts, average value, and share-via-limited-tender.
2. **Searchable contract table** — every contract, virtualised, filter by agency/supplier/category/method/state, sort by value or date, click for detail.
3. **Relationship map** — force-directed bipartite graph of top suppliers ↔ agencies, filterable by category.
4. **Spend-flow (Sankey)** — value flowing from agencies → procurement categories.
5. **Agency × category matrix** — heatmap revealing where each agency concentrates spend.
6. **State map** — Leaflet choropleth of supplier value by state/territory.
7. **Monthly trend** — time-series of spend and contract counts.
8. **Notable contracts / insights** — auto-detected outliers: billion-dollar deals, high concentration of limited tenders, single-supplier dominance.
9. **Glossary + About modal** — explains AusTender, UNSPSC, limited vs open tender, procuring entity, etc.

## Target Audience (detailed)
A journalist on deadline wanting the top 20 consultancy suppliers and their total
take; a policy analyst on desktop comparing agency procurement patterns; a small
business owner checking who currently supplies a given agency before bidding; a
citizen who read a headline about "$1bn in consultants" and wants to see it. Tech
comfort ranges from high (analysts) to low (public) — hence heavy inline
education and plain-English labels.

## Style Direction
**Tone:** professional / civic — authoritative but readable.
**Colour palette:** clean light theme, deep navy (#0f2d4a) primary with a teal
accent (#0d9488) and a warm amber for "limited tender" warnings. Official,
trustworthy, like a well-designed government transparency portal — not a hacker
terminal.
**UI density:** balanced-to-dense — data-rich dashboard, but generous enough that
a non-expert isn't overwhelmed.
**Dark/light theme:** light (civic/transparency audience).
**Reference sites for tone:** courtwatch.us, GOV.UK spending dashboards, the
existing au-donations sibling site.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite
- **Data strategy:** pipeline (GitHub Actions downloads OCDS bulk files, aggregates to compact JSON in public/data/)
- **Key libraries:** Leaflet (state map). Everything else hand-rolled SVG (bars, matrix, network force sim, Sankey, treemap).

## Layout
Fixed header (title, last-updated, view tabs, About/glossary buttons). Main area
is a single scrolling column of view "panels" switched by tabs. Global filter bar
(search + category/method/state selects) persists across data views. Sticky
footer with attribution. Below 768px: tabs become a horizontal scroll, tables
reflow to card rows, charts shrink.

## Pages/Views
Single page, tabbed views:
1. Overview (headline stats + notable contracts + mini trend)
2. Suppliers (leaderboard)
3. Agencies (leaderboard)
4. Contracts (searchable virtual table)
5. Relationship map (network)
6. Flow (agency → category Sankey)
7. Matrix (agency × category heatmap)
8. Map (state choropleth)
9. Trends (monthly time series)
10. Insights (auto-detected anomalies)

## Visualization Strategy
- **Table** (sortable/filterable/virtualised) — the raw record, for verification & drill-down. Only view that shows individual contracts.
- **Leaderboards (bar)** — answers "who is biggest?" for suppliers and agencies; the newsworthy default.
- **Relationship network** — reveals which suppliers depend on which agencies and who is diversified vs single-agency; a table can't show this structure.
- **Sankey flow** — shows how each agency's spend splits across procurement categories and which categories dominate overall; complements the matrix with magnitude-as-width.
- **Matrix heatmap** — instantly surfaces agency/category concentration (e.g. one agency dominating "management advisory"); a scan a human can't do across a table.
- **State map** — geographic distribution of where supplier value lands; a dimension no bar chart conveys.
- **Monthly trend** — seasonality and end-of-financial-year spikes; time dimension.
- **Treemap (within categories view)** — composition of total spend by category at a glance.
- **Histogram (within insights)** — distribution of contract values to show the long tail and outliers.
