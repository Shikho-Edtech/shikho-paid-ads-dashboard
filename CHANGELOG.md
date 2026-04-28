# Changelog

## 2026-04-21 — v0.1.1: auth + staleness banner + project rules
- Password gate via `DASHBOARD_PASSWORD` + signed cookie via `AUTH_SECRET` — middleware redirects every non-public route to `/login`. Mirrors the organic-social-dashboard pattern verbatim. Routes spared: `/login`, `/api/auth`, Next internals.
- `<StalenessBanner />` rendered above the page header. Per-channel — surfaces only when at least one expected channel hasn't reported in 26h+ (yellow) or 50h+ (red). Hidden when everything is fresh, so it stops being noise.
- `CLAUDE.md` added — mirrors organic-social-dashboard project rules: mobile checklist, brand v1.0 hard rules, 8-perspective QA gate, post-commit doc routing.
- `.gitignore` extended to catch `*creds*.json`, `service-account*.json`, `client_secret*.json` so an accidental local copy can never be committed.

## 2026-04-21 — v0.1 scaffold
First scaffold of the paid-ads dashboard. Next.js 14 + Tailwind 3.4 + Recharts. Mirrors `shikho-organic-social-analytics/organic-social-dashboard` architecture and brand system. Single overview page with: KPI strip (total / Meta / Google / combined spend, conversions, CPA, ROAS), daily-spend stacked chart, funnel-stage mix bar, top-objectives table. Reads `Raw_Insights` from both pipeline sheets server-side via `googleapis` with 10-min ISR. Funnel stage derived inline from objective via rule map (placeholder until Phase 2 classifier ships). Empty-states for Google channel until that pipeline runs.
