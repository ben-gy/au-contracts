# Government Contracts (AU) — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/au-contracts/ *(redirects to custom domain once DNS is set)*
- **Custom domain:** https://au-contracts.benrichardson.dev *(live after DNS + cert below)*

## What it is

A searchable, visual explorer for Australian Government procurement — every AusTender contract notice for FY2023‑24 and FY2024‑25 (~166k notices → 121k unique contracts, $126.8B), aggregated into supplier/agency/category leaderboards, a professional & consulting focus, the 1,000 biggest contracts, a supplier↔agency network, a category→agency Sankey, an agency×category matrix, a monthly trend, a supplier‑state map, and auto‑detected findings.

## DNS setup (already applied)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `au-contracts` | `ben-gy.github.io` | DNS only (grey cloud) |

If the cert isn't live, re‑trigger issuance:
```bash
gh api repos/ben-gy/au-contracts/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/au-contracts/pages -X PUT -f cname="au-contracts.benrichardson.dev"
```
