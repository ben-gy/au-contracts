# Government Contracts (AU) — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-contracts/ *(redirects to custom domain)*
- **Custom domain:** https://au-contracts.benrichardson.dev *(live — HTTP 200, TLS enforced)*

## What it is

An explorer for Australian federal government procurement — every AusTender contract notice for **FY2025-26** (~66,000 contracts, ~$118B, 128 agencies) pulled from the live Open Contracting (OCDS) API. Leaderboards, supplier↔agency network, spend-flow Sankey, agency×category matrix, Leaflet state map, monthly trends, auto-detected insights, and a searchable contract database with drill-down.

## Note on the build

This site was produced during a concurrent run. The deployed `main` is the **browser-verified** build: all 11 views (including the Leaflet map, which required a container-sizing fix) were confirmed rendering with real data, and all 49 unit tests pass. An earlier divergent implementation was replaced with this verified version via a force-push.

## Verification

- [x] `npm test` — 49 tests pass
- [x] `npm run build` — clean (tsc + vite)
- [x] Deploy workflow succeeded
- [x] Live site confirmed at https://au-contracts.benrichardson.dev (HTTP 200)
- [x] All views verified in-browser (overview, suppliers, agencies, categories, contracts table, network, flow, matrix, map, trends, insights, drill-down drawer, mobile)
