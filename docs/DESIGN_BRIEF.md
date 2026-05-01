# DESIGN_BRIEF — paid-ads-dashboard

Single-source spec for any UI change in this repo. Adapted from the
companion `shikho-organic-social-analytics/organic-social-dashboard/
docs/DESIGN_BRIEF.md` because both dashboards share the Shikho v1.0
brand system, the same primary reader, the same mobile-first floor,
and the same data-honesty discipline. Where the two diverge, this file
overrides.

Companion docs:
- `BRAND.md` — palette, type, forbidden patterns (binding).
- `../CLAUDE.md` — mobile checklist + 7-perspective QA gate (binding).
- `../CHANGELOG.md` / `../DECISIONS.md` / `../LEARNINGS.md` — running
  history of what shipped, why, and what to remember.
- `../../CONTRACTS.md` (master repo) — the cross-repo lockstep rules
  for sheet column names, env vars, taxonomies.

Last updated: 2026-05-02.

---

## 1. Mission

Give one analyst (Shahriar) a daily answer to: **"is our paid-ads
investment landing where I want it, and what should I shift this
week?"** — readable on a phone in under 60 seconds, defensible in
data honesty, aligned to Shikho's brand.

**Primary reader:** Shahriar · daily mid-morning BDT · mobile-first
(360 px floor).
**Secondary:** occasional desk review on 1280 px+.
**Not users:** team members, leadership, clients. No multi-user, no
sharing, no export.

**Architectural constraints this design must honour:**

1. **Two-platform parity is structural, not semantic.** Meta's
   `OUTCOME_*` objectives and Google's `channel_type` /
   `bidding_strategy_type` do not map 1:1. Cross-platform charts must
   render Meta and Google buckets as separate rows even when labels
   collide. There must be a visible note explaining the asymmetry on
   any chart that shows both.
2. **Account-currency native.** Spend is USD for Shikho's accounts.
   No FX conversion at the dashboard layer. If a non-USD account ever
   gets added, the dashboard must surface a banner — never silently
   average mismatched units.
3. **Pipeline drives data freshness.** Both daily pipelines run at
   02:00 / 02:30 UTC. The dashboard reads from Sheets at request time
   (10-min ISR). The "Data as of" stamp on every page reflects the
   older of the two pipeline run times — not Vercel's render time.
4. **No LLM on the dashboard.** Every page renders a useful answer
   without any AI provider keys. Heavy stats live in Python at the
   pipeline layer (scipy / numpy / pandas writing derived columns to
   Sheets). The dashboard is a thin TypeScript renderer.
5. **Append-only schemas.** The dashboard reads sheet columns by
   header name. A pipeline-only column rename silently zeros that
   field on the dashboard — see `../../CLAUDE.md` cross-repo lockstep
   rule.

---

## 2. Information architecture

| Page | What it answers | Primary data | Status |
|---|---|---|---|
| `/` Overview | "Is the account healthy right now?" | both pipelines `Raw_Insights` | shipping |
| `/spend` | "Where's the money going by objective × optimization × ad signal?" | both `Raw_Insights` joined to `Raw_AdSets`, `Raw_AdGroups`, `Raw_Ads`, `Raw_Campaigns` | shipping (v0.4) |
| `/conversions` | "Which conversion actions actually drive results?" | Google `Raw_Conversion_Actions` + `Raw_Insights_Conversions`, Meta actions JSON | shipping |
| `/auction` (planned) | "Who am I competing against, and how am I doing in the auction?" | Google `Raw_Auction_Insights` (blocked on Standard Access tier) | deferred |
| `/creative` (planned) | "Which creatives / assets are winning?" | both `Raw_Ads` + `Raw_Creatives` (Meta) + `Raw_Asset_Performance` (Google) | deferred |

Nav (≥ md) = horizontal tabs; below md = dropdown
(`components/Nav.tsx` pattern).

---

## 3. The page surfaces

Every page has these layers, top to bottom:

1. **`<StalenessBanner status={runStatus} />`** — required, before any
   rendered data. Surfaces only when stale. Reads `runStatus` per
   channel.
2. **`<PageHeader title=… subtitle=… metaLastRun=… googleLastRun=…
   rightSlot={…} />`** — title + subtitle + "Data as of …" timestamp
   + optional right-side controls (date picker, comparison toggle).
3. **KPI strip** — 4-5 `<KpiCard />` tiles in a `grid-cols-2
   lg:grid-cols-4-or-5`. Use the `delta` prop (signed %) when
   `?compare=1`; use `hint` for static descriptors.
4. **Primary visual** — usually a `SectionCard` wrapping a chart.
5. **Breakdown SectionCards** — three-column on `lg`, one-column
   below. Each has a topic title + plain-English subtitle + meta pill
   showing bucket count.
6. **Detail table** — `SectionCard` with `overflow-x-auto` table.
   Columns hide responsively (e.g. bid_strategy below md, share/ads
   counts below sm) and reappear inline under the primary cell on
   mobile.
7. **Data Status footer** (optional but recommended) — per-channel
   row count + spend in window. When a channel returns 0 rows, the
   border turns coral and points to `/api/debug`.

---

## 4. The components contract

The repo's `components/` directory is the design system surface.
Every component is mobile-first, uses Shikho v1.0 tokens, and
documents its prop API at the top of the file.

| Component | Use | Owns |
|---|---|---|
| `Card` | Base surface | Paper white, ink-100 hairline, rounded-3xl, shadow-ambient |
| `SectionCard` | Card + header | Title / subtitle / optional meta pill / optional caption |
| `PageHeader` | Page title + freshness stamp | Stacks rightSlot on mobile, formats BDT timestamp |
| `KpiCard` | Big-number tile | Indigo gradient, delta %, optional channel pill |
| `DateRangePicker` | URL-driven date filter | Presets (7/14/30/60/90) + custom |
| `Nav` | Routing | md+ tabs, <md dropdown |
| `StalenessBanner` | Freshness alert | Hidden ok / yellow warn / red crit |
| `SpendChart` | Daily stacked bar | Recharts, channel-coded |
| `SpendBucketBar` | Ranked dimension list | Channel-coded rows + Δ pills |
| `HierarchyExplorer` | Campaign → AdGroup → Ad drill | Filter chips + table |
| `ChannelStatus` | Per-channel chip | Last run / row count |

When adding a new component:
1. Read the org-social `components/` for prior art before inventing.
2. Land mobile-first patterns by default (no `flex-wrap` for header
   alignment, popups clamp to `calc(100vw - 2rem)`, tables in
   `overflow-x-auto`).
3. Use Shikho tokens only — no `slate-*`, no `gray-*`, no `zinc-*`,
   no inline hex outside `lib/colors.ts`.
4. Add a one-line entry in `LEARNINGS.md` if you discovered a new
   gotcha (mobile overflow class, brand violation pattern, etc.).

---

## 5. Brand expression on charts

Every chart leads with the four Shikho core hues:

- `#304090` indigo-600 — primary bars, lines, KPI values
- `#C02080` magenta-500 — accent / second series
- `#E0A010` sunrise-500 — top-of-funnel, positive delta pill
- `#E03050` coral-500 — negative delta pill, alerts

Plus channel accents for cross-platform charts:
- `#1877F2` Meta — Facebook brand blue
- `#EA4335` Google — Google brand red (NOT blue — see
  `lib/colors.ts` comment for why)

Recharts defaults are banned. Every chart sets explicit `fill` /
`stroke` from `lib/colors.ts`.

---

## 6. Cross-platform asymmetry — the always-visible note

When a chart shows Meta and Google buckets together, the page MUST
include a visible note (typically a `rounded-2xl border-shikho-sunrise-200
bg-shikho-sunrise-50/60` aside) explaining:

- Meta `objective` = `OUTCOME_TRAFFIC` / `OUTCOME_SALES` / etc.
- Google `channel_type` = `SEARCH` / `DISPLAY` / `VIDEO` / `PERFORMANCE_MAX` / etc.
- The two are not 1:1 even when labels look similar
- Sums across the platforms are mathematically valid (USD spend is
  the same unit) but cross-platform shape comparisons are not

This is the dashboard's only structural defense against silent
apples-to-oranges interpretation.

---

## 7. Mobile-first patterns (binding)

See `../CLAUDE.md` for the full pre-commit checklist. The five
non-negotiable patterns:

1. **Stress-test at 360 / 375 / 414 / 768 / 1280.** 360 is the floor.
2. **No `flex-wrap` for header alignment.** Use `flex-col sm:flex-row`.
3. **Big values get `break-words leading-tight` + responsive sizes.**
   `text-2xl sm:text-3xl`, never `text-3xl` alone in a 2-col grid.
4. **Tables live inside `overflow-x-auto`.** Hide non-essential
   columns below `sm:` / `md:` and reflow them inline under the
   primary column on mobile (see `/spend` Top-20 table for the
   canonical pattern).
5. **No hover-only tooltips.** Use `<InfoTooltip />`-style tap +
   focus + hover.

---

## 8. The 7-perspective pre-commit QA gate

Mirrored from `../CLAUDE.md`. Every UI-touching commit must walk:

1. **Viewport sweep** at 360 / 768 / 1280
2. **Data extremes** — empty / single-row / max-realistic
3. **Interaction modes** — keyboard tab, focus visible, no
   hover-only affordances
4. **Accessibility** — contrast ≥ 4.5:1, dynamic content has
   `role="status"`/`aria-live`, tap targets ≥ 44×44 px
5. **Error + loading states** — `app/loading.tsx` and `app/error.tsx`
   actually trigger
6. **Build + type-check** — `npm run build` green, no unused
   imports, no missing `"use client"` directives
7. **Cold-read test** — reopen as if you'd never seen it. Headline
   answers "what is this?" First KPI answers "is this good or bad?"
8. **Brand compliance** — `grep -r "slate-\|gray-\|zinc-" app/
   components/ lib/` returns zero hits in new files.

Report what was checked and what was caught in the commit summary.

---

## 9. Auth + middleware

Every route except `/login`, `/api/auth`, and Next internals goes
through `middleware.ts`. Cookie signed by `AUTH_SECRET`. Adding a new
public route: update the `pathname.startsWith` allowlist there. Do
not bypass auth via per-page logic.
