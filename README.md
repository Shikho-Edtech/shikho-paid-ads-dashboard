# Shikho Paid Ads Dashboard

Next.js 14 dashboard for cross-channel paid media reporting. Reads
`Raw_Insights` from both the Meta Ads pipeline sheet and the Google Ads
pipeline sheet, unifies the rows, and renders a single overview.

Mirrors the architecture of `shikho-organic-social-analytics/organic-social-dashboard`.

## What v0.1 ships

- KPI strip: total spend, Meta vs Google split, conversions, CPA, ROAS
- Daily spend chart (stacked: Meta + Google)
- Funnel-stage spend mix (TOFU / MOFU / BOFU, derived inline from objective)
- Top objectives table (channel, stage, spend, conversions, CPA)
- Channel status chips (last run, has-data signal)

Date window: trailing 30 days, BDT. Server-side ISR (10 min revalidate).

## Local setup

```bash
cd paid-ads-dashboard
cp .env.example .env.local
# fill in:
#   GOOGLE_SHEETS_CREDS_JSON  — full SA JSON, stringified
#   META_SPREADSHEET_ID       — Meta pipeline sheet ID
#   GOOGLE_ADS_SPREADSHEET_ID — Google Ads pipeline sheet ID

npm install
npm run dev
```

Open http://localhost:3000.

## Deploy on Vercel

1. New project → import `shikho-paid-ads-dashboard` repo (once split out).
2. Framework preset: Next.js. Build cmd: `npm run build`. Output: `.next`.
3. Env vars (Production + Preview):
   - `GOOGLE_SHEETS_CREDS_JSON`
   - `META_SPREADSHEET_ID`
   - `GOOGLE_ADS_SPREADSHEET_ID`
4. Deploy.

## Funnel-stage mapping

Inline rule map in `lib/funnel.ts`. Phase 2 of the master roadmap will
ship a Python classifier that writes a `Classifications` tab; once that
exists, swap the inline derivation for a sheet-read.

## Related repos

- [shikho-meta-ads-pipeline](https://github.com/Shikho-Edtech/shikho-meta-ads-pipeline)
- [shikho-google-ads-pipeline](https://github.com/Shikho-Edtech/shikho-google-ads-pipeline)
- [shikho-paid-ads-analytics](https://github.com/Shikho-Edtech/shikho-paid-ads-analytics) — master docs
