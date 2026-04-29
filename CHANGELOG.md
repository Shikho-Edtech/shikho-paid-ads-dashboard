# Changelog

## 2026-04-29 — v0.2: real data + USD + hierarchy explorer + date range
First production-data render. Three structural changes shipped together:

1. **Column-name fixes (data flow).** v0.1 mapper expected snake_case headers but both pipelines write display-friendly headers (`Spend (USD)`, `Date (BDT)`, `Actions (JSON)`, `Cost (USD)`, `Channel Type`). Updated `metaRowToInsight` and `googleRowToInsight` to use the exact strings — every column reference is now contract-verified against `<pipeline>/src/sheets.py::RAW_INSIGHTS_HEADERS`. Same fix applied to `Analysis_Log` reader (`Run At (BDT)`, `Fetch Status`).

2. **USD throughout.** Both platforms return spend in account currency natively (USD for Shikho). Renamed `fmtBDT` → `fmtUSD` (`$` prefix, K/M/B suffixes, no Cr/L). Updated every UI label and comment from BDT to USD. The hardcoded BDT discipline in CONTRACTS.md was wrong; will update there next.

3. **Hierarchy explorer + date range.** New `HierarchyExplorer` component shows spend / impressions / clicks / conv / CPA aggregated at three levels (Campaign / Ad Group / Ad) with platform tabs (All / Meta / Google) and an objective dropdown. New `DateRangePicker` is URL-state driven (`?days=N` or `?start&end`) so the server component re-renders with the right window — bookmarkable, sharable, and filterable from 7d to custom. Added `byCampaign / byAdGroup / byAd` aggregations + `distinctObjectives` to `lib/aggregate.ts`. Extended `UnifiedInsight` with `ad_group_id/name`, `ad_id/name`.

## 2026-04-21 — v0.1.1: auth + staleness banner + project rules
- Password gate via `DASHBOARD_PASSWORD` + signed cookie via `AUTH_SECRET` — middleware redirects every non-public route to `/login`. Mirrors the organic-social-dashboard pattern verbatim. Routes spared: `/login`, `/api/auth`, Next internals.
- `<StalenessBanner />` rendered above the page header. Per-channel — surfaces only when at least one expected channel hasn't reported in 26h+ (yellow) or 50h+ (red). Hidden when everything is fresh, so it stops being noise.
- `CLAUDE.md` added — mirrors organic-social-dashboard project rules: mobile checklist, brand v1.0 hard rules, 8-perspective QA gate, post-commit doc routing.
- `.gitignore` extended to catch `*creds*.json`, `service-account*.json`, `client_secret*.json` so an accidental local copy can never be committed.

## 2026-04-21 — v0.1 scaffold
First scaffold of the paid-ads dashboard. Next.js 14 + Tailwind 3.4 + Recharts. Mirrors `shikho-organic-social-analytics/organic-social-dashboard` architecture and brand system. Single overview page with: KPI strip (total / Meta / Google / combined spend, conversions, CPA, ROAS), daily-spend stacked chart, funnel-stage mix bar, top-objectives table. Reads `Raw_Insights` from both pipeline sheets server-side via `googleapis` with 10-min ISR. Funnel stage derived inline from objective via rule map (placeholder until Phase 2 classifier ships). Empty-states for Google channel until that pipeline runs.
