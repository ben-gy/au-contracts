# Site Plan: Government Contracts (AU)

## Overview
- **Name:** Government Contracts (AU)
- **Repo name:** au-contracts
- **Tagline:** Follow the public money — every Australian Government contract, ranked by supplier, agency and category.

### Naming Convention
Country-specific → "Government Contracts (AU)".

## Target Audience
Journalists, policy researchers, taxpayers, opposition staffers, procurement/bid managers, and civic-minded citizens who want to see where Commonwealth money goes — which suppliers win the most, which agencies spend the most, how much goes to consulting firms, and which contracts are the biggest.

## Value Proposition
AusTender publishes every federal contract but its search UI is clunky and offers no aggregation, leaderboards, or visual analysis. This turns ~150k raw contract notices (two financial years) into instant answers: top suppliers, top agencies, category flows, the big consultancies' share, biggest single contracts, and auto-detected anomalies — all in one fast, bookmarkable dashboard.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| AusTender OCDS API | https://api.tenders.gov.au/ocds/findByDates/contractPublished/{start}/{end} | Every Commonwealth contract notice: value, supplier (name+ABN+state), buyer agency, UNSPSC category, dates, procurement method | Continuous (weekly reporting window) | No |
| UNSPSC segment map | (embedded) | Maps 8-digit UNSPSC codes to top-level category names | Static | No |

## Key Features
1. **Supplier leaderboard** — every supplier ranked by total won, contract count, agency reach; searchable, sortable.
2. **Agency leaderboard** — every buyer agency ranked by total spend, with category breakdown.
3. **Category breakdown** — spend by UNSPSC segment (IT, professional/consulting services, defence, construction, health...).
4. **Consulting focus** — carve out professional & consulting services spend and rank the firms.
5. **Biggest contracts table** — the top individual contracts with full detail, sortable/filterable.
6. **Supplier ↔ agency network graph** — who sells to whom (top players).
7. **Category → agency flow (Sankey)** — where each category of spend lands.
8. **Agency × category matrix** — heatmap revealing concentration.
9. **Monthly trend** — spend over time across the covered period.
10. **Auto insights** — outlier suppliers, single-supplier-dominated agencies, huge YoY category shifts.
11. **Drill-downs** — click any supplier or agency for a full detail panel (URL-hash linkable).

## Target Audience (detailed)
Desktop-first users: a journalist on deadline scanning for the biggest consulting winners; a researcher comparing FY2023-24 vs FY2024-25; a citizen curious who got the money. Tech-comfortable but not data scientists — everything must be labelled and explained.

## Style Direction
**Tone:** civic / authoritative, but modern and readable — not a dull government portal.
**Colour palette:** light, official navy/teal with a warm gold accent for "money"; clean whites, restrained. Category colours are a fixed qualitative palette used consistently across every view.
**UI density:** balanced-to-dense — leaderboards and tables are the core, but with generous headers and clear section framing.
**Dark/light theme:** light (civic/transparency audience); respects system dark mode via CSS variables.
**Reference sites for tone:** OpenAustralia/They Vote For You, US courtwatch.us, GOV.UK performance dashboards.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (single-page, tab-based dashboard; no routing library needed).
- **Data strategy:** pipeline. `pipeline/collect.mjs` pulls the OCDS API over a rolling window, `pipeline/aggregate.mjs` produces compact JSON in `public/data/`. GitHub Actions cron refreshes.
- **Key libraries:** Leaflet (supplier-state map) + hand-rolled SVG for bars, network, flow, matrix, treemap. No chart library.

## Layout
Fixed header (title, period covered, total spend, search, ? about, glossary). Tab bar for views. Main content fills width up to 1600px. Footer sticky with attribution. Drill-down slide-in panel from the right. Mobile: tabs scroll horizontally, tables become card-ish, panels stack.

## Pages/Views
Single page, tabbed: Overview · Suppliers · Agencies · Categories · Consulting · Biggest · Network · Flow · Matrix · Map · Insights.

## Visualization Strategy
- **Table views** (suppliers, agencies, biggest contracts) — sortable/filterable/searchable. Core.
- **Horizontal bar charts** (top suppliers, top agencies, categories) — ranking at a glance.
- **Treemap** (category composition) — whole-of-government spend split by category in one frame.
- **Supplier↔agency network graph** — reveals concentration and which suppliers span many agencies (hand-rolled force sim, SVG).
- **Category→agency Sankey flow** — where each category's money lands.
- **Agency×category matrix heatmap** — instantly shows which agencies concentrate spend in which categories.
- **Monthly time-series** — trend + seasonality (end-of-FY spikes).
- **Leaflet map** — supplier spend by state/territory (choropleth via state centroids/GeoJSON).
- **Insights cards** — computed anomalies/leaders.
Each view answers a distinct question; ≥5 well beyond the floor.
