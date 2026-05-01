# CLAUDE.md — paid-ads-dashboard

Project-specific rules. Layered under the global `~/.claude/CLAUDE.md` and the master-level `paid-ads-analytics/CLAUDE.md` + `paid-ads-analytics/CONTRACTS.md`.

> **Read in this order:** master `paid-ads-analytics/CONTRACTS.md` (cross-repo agreements: sheet schemas, env vars, taxonomies) → this file (how we work in this repo) → `docs/DESIGN_BRIEF.md` (page-level visual contract) → `docs/BRAND.md` (palette + forbidden patterns).
>
> The running history of this repo lives in three sibling files at the repo root:
> - **`CHANGELOG.md`** — what shipped, version-tagged, terse.
> - **`DECISIONS.md`** — tradeoffs worth remembering, with the alternatives we rejected and the rules that flow forward.
> - **`LEARNINGS.md`** — gotchas worth pre-empting, with detection rules so the same class of bug doesn't recur.
>
> Update all three after any UI-touching commit. Mobile regressions ALWAYS go in `LEARNINGS.md`.

## Where the design system comes from

This repo's components, brand tokens, and page-level patterns mirror the companion **`shikho-organic-social-analytics/organic-social-dashboard`** because both dashboards are part of the same Shikho analytics product family — they share a primary reader, the Shikho v1.0 brand system, the 360 px mobile floor, and the data-honesty discipline. When in doubt, look there first for prior art before inventing.

Imported as-is (with paid-ads adaptations noted in-place):
- `docs/BRAND.md` — palette, type, forbidden patterns
- `docs/DESIGN_BRIEF.md` — IA, page surface contract, components contract, the 7-perspective QA gate

The four surface primitives every page composes from:
- **`<Card>`** — paper white, ink-100 hairline, rounded-3xl, shadow-ambient. Optional `kind` accent: `observed` / `derived` / `meta` / `google`.
- **`<SectionCard>`** — Card + header (title + subtitle + optional meta pill) + body slot.
- **`<PageHeader>`** — page title + "Data as of …" stamp from `runStatus` + `rightSlot` (date picker, compare toggle).
- **`<KpiCard>`** — paper → indigo-50/40 gradient, responsive text sizes, optional `delta` (signed %) + `deltaAbs` (USD), optional channel pill.

Inline-styled `<div className="rounded-xl border ...">` blocks that approximate these are the failure pattern. See `LEARNINGS.md` 2026-05-02 entry.

---

## Mobile-first is the default

Every change that touches layout, text, or interactive elements must work at **360px width** (small Android) through **desktop (1280px+)**. Not "look acceptable" — actually work.

This is not a nice-to-have; it's project policy. Past commits in the sister organic-social-dashboard shipped with desktop-only assumptions that had to be fixed in follow-up commits. Don't repeat.

### Pre-commit mobile checklist

Before any commit that changes UI:

1. **Right-edge scan.** Read every new/modified element: what happens if content is 30% longer than sample data? Failure mode is text pushing past the card's right edge or forcing horizontal page scroll.
2. **No `flex-wrap` for header alignment.** When two items sit side-by-side on desktop but stack on mobile, use `flex-col sm:flex-row`, never `flex-wrap`. The latter makes alignment drift with content length.
3. **Popups and dropdowns get `max-w-[calc(100vw-2rem)]`.** Every absolute-positioned popup must clamp to viewport.
4. **Big-text values get `break-words leading-tight`.** Any `text-2xl`/`text-3xl` inside a narrow mobile column will overflow on 7-digit numbers. Use `text-xl sm:text-2xl` + `break-words`.
5. **No hover-only tooltips.** Touch devices don't fire `:hover`.
6. **Tables live inside `overflow-x-auto`**, full stop.
7. **Tab bars over `md` breakpoint only.** Below `md`, switch to a dropdown.

### Stress-test widths

360, 375, 414, 768, 1280. 360px is the realistic floor (small Androids). Anything narrower isn't worth optimizing for.

---

## Brand system — Shikho v1.0 only

Same palette as organic-social-dashboard. Source of truth is `tailwind.config.ts` of this repo (mirrors the master spec).

### Hard rules

- **No `slate-*` / `gray-*` / `zinc-*` classes.** Use `text-ink-*`, `bg-ink-paper`, `bg-brand-canvas`, `border-ink-100`.
- **No Inter font.** Poppins + Hind Siliguri only.
- **No legacy Tailwind dark hexes** (`#0b1120`, `#111827`, etc.). Remap to Shikho ink.* / shikho-indigo-*.
- **No ad-hoc chart hexes.** Charts lead with the four Shikho core hues (`#304090` indigo, `#C02080` magenta, `#E0A010` sunrise, `#E03050` coral) plus the channel accents (`#1877F2` Meta, `#4285F4` Google) — extend `lib/colors.ts`, don't inline one-offs.
- **Token names over values.** Prefer `text-shikho-indigo-700` over `#252F73` so a future palette shift lands in `tailwind.config.ts` alone.

### Brand audit (when ratchet ships)

`npm run brand:audit` will scan for the banned patterns above with a ratchet baseline. Until that's wired up: use grep before commit.

```
grep -r "slate-\|gray-\|zinc-" app/ components/ lib/
```

Should return zero hits in new files.

---

## Pre-commit QA gate

`npm run build` is necessary but **not sufficient**. Every UI-touching commit must pass these eight perspectives:

1. **Viewport sweep** — walk every changed page at 360 / 768 / 1280. Anything that overflows or stacks weirdly on 360px is a fail.
2. **Data extremes** — empty data, single row, max-realistic data (long labels, 7-digit numbers, 30+ campaigns), stale artifact.
3. **Interaction modes** — keyboard tab through every new control. Focus visible, tab order sensible, no hover-only affordances.
4. **Accessibility** — text contrast ≥ 4.5:1, dynamic content has `role="status"`/`aria-live`, tap targets ≥ 44×44px.
5. **Error + loading states** — `app/loading.tsx` and `app/error.tsx` actually trigger.
6. **Build + type-check** — `npm run build` green, no unused imports, no missing `"use client"` directives.
7. **Cold-read test** — reopen as if you'd never seen it. Headline answers "what is this?" First KPI answers "is this good or bad?"
8. **Brand compliance** — no new violations.

Report what was checked and what was caught in the commit summary, not as checkmarks but as prose.

---

## Staleness awareness — required on every page

Pages backed by sheet data **must** render `<StalenessBanner />` above `<PageHeader />`. The banner reads `RunStatus` per channel and surfaces:

- Hidden when every channel ran within 26h
- Yellow when any channel is 26-50h stale
- Red when any channel is >50h stale or has never reported

Why this exists: the pipelines fail-soft. A 3-day cron failure with no banner means the dashboard renders 3-day-old numbers as if they were today's. The banner is the single load-bearing UX defense against silent staleness.

When adding a new pipeline, extend `lib/sheets.ts::getRunStatus()` to read its `Analysis_Log` and add a per-channel field to `RunStatus`. The banner picks it up via the registry pattern.

---

## Auth gate

Every route except `/login`, `/api/auth`, and Next internals goes through `middleware.ts`. The middleware checks for a signed cookie issued after password match against `DASHBOARD_PASSWORD`.

When adding a new public route (e.g., a webhook endpoint), update the `pathname.startsWith` allowlist in `middleware.ts`. Do not bypass auth via per-page logic.

`AUTH_SECRET` env var (≥32 random chars) signs the cookie. Rotating it forces every session to log in again — useful after a password leak.

---

## Post-commit documentation

Per master CLAUDE.md, every commit updates one or more of: this repo's `CHANGELOG.md`, `DECISIONS.md` (tradeoffs worth remembering), `LEARNINGS.md` (gotchas worth pre-empting). Mobile regressions ALWAYS go in `LEARNINGS.md` so the same class of bug doesn't keep reappearing.

A new commit should never add a sheet column read without a corresponding pipeline write in the same session. See master `CONTRACTS.md` §6.1 (lockstep rule).
