# Changelog

## 2026-04-21 — v0.1 scaffold
First scaffold of the paid-ads dashboard. Next.js 14 + Tailwind 3.4 + Recharts. Mirrors `shikho-organic-social-analytics/organic-social-dashboard` architecture and brand system. Single overview page with: KPI strip (total / Meta / Google / combined spend, conversions, CPA, ROAS), daily-spend stacked chart, funnel-stage mix bar, top-objectives table. Reads `Raw_Insights` from both pipeline sheets server-side via `googleapis` with 10-min ISR. Funnel stage derived inline from objective via rule map (placeholder until Phase 2 classifier ships). Empty-states for Google channel until that pipeline runs.
