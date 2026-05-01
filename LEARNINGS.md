# LEARNINGS — paid-ads-dashboard

Gotchas, wrong turns, and patterns worth pre-empting on the next pass.
Pair with `DECISIONS.md` (the why) and `CHANGELOG.md` (the what).

Mirrors the format of `shikho-organic-social-analytics/organic-social-dashboard/LEARNINGS.md`.
Most entries are a paragraph of context + a "lesson" + a "detection
rule for next time." Brevity matters; this file is read before
proposing a change, not skimmed for vibes.

---

## 2026-05-02 — Inline-styled cards on /spend v0.1 read as "very bad"

Shipped /spend v0.1 with the page composing surfaces from inline-styled
`<div className="rounded-xl border ...">` blocks instead of using a
shared `Card` / `SectionCard` component. The result looked nothing
like the rest of the family — the user's exact reaction was *"the
design is very bad."*

**Lesson:** before writing any new page in this repo, audit
`components/` first AND read the companion organic-social-dashboard
to see what's already proven. The Shikho v1.0 system has 4 surface
primitives (`Card`, `SectionCard`, `PageHeader`, `KpiCard`) — every
page composes from those. Inline-style divs that approximate them are
the failure pattern.

**Detection rule:** before commit, grep for `rounded-2xl bg-ink-paper`
or `rounded-xl border border-ink-100` in any new `app/*/page.tsx`. If
they appear, the page is bypassing the design system. Refactor to
`<Card>` / `<SectionCard>` before shipping.

---

## 2026-05-02 — Cross-platform charts that merge buckets fake parity that doesn't exist

First sketch of the spend page tried to render Meta and Google
objectives in the same bar chart, sorting by combined spend. Looked
clean. Was wrong: Meta `OUTCOME_TRAFFIC` ≈ Google "Search Max
Conversions" is not even close to true, and a sorted combined chart
implies a comparison the data doesn't support.

**Lesson:** the SpendBucket rollup must be keyed by `(channel, key)`
— never `key` alone. Even if both platforms emit a label called
"TRAFFIC", they stay as separate rows. Every cross-platform chart
must carry an explicit asymmetry note explaining what each platform's
label actually means. See `docs/DESIGN_BRIEF.md §6`.

**Detection rule:** any aggregator that returns
`Map<string, T>` keyed by a dimension value alone is a bug if the
dimension can be platform-specific. Key shape should be
`Map<string, T>` where the key is `${channel}|${key}` or use
`Map<Channel, Map<string, T>>`.

---

## 2026-05-02 — "Meta has 0 spend" is silently indistinguishable from real-zero unless we surface row counts

The user reported "no spend in Meta" after /spend v0.1 shipped. Three
possible root causes for that symptom, all visually identical:

1. Meta sheet hasn't refreshed (cron failed) → real data, just stale
2. Date range outside Meta's `date_min` / `date_max` → real data, wrong filter
3. Sheet read silently failed → no data reached the dashboard at all

The page rendered all three the same way: Meta KPI shows $0, all
Meta-channel buckets are absent, no error. Indistinguishable.

**Lesson:** every page that fans out across multiple data sources
needs a Data Status surface that shows per-source row count + total
spend in window. When a source returns 0 rows, the surface must
visibly flag it (coral border, link to `/api/debug`). This is the
single load-bearing UX defense against silent data loss.

**Pattern shipped:** `/spend` now has a `<SectionCard title="Data
status">` at the bottom that shows per-channel `metaCur.length` and
`googleCur.length`. When either is 0 the card border turns coral and
points at `/api/debug`.

**Detection rule:** any page that calls `getEnrichedInsights()` or
`getAllInsights()` should also render row counts somewhere on the
page. Symbolic cost is one SectionCard at the bottom; payback is
seconds-to-diagnose vs hours-to-diagnose when something silently
drops.

---

## 2026-05-02 — Lookup readers that fan out to large entity tabs can blow Vercel's serverless function limits

Building the spend page meant joining `Raw_Insights` to four extra
entity tabs (`Raw_AdSets`, `Raw_AdGroups`, `Raw_Ads` ×2,
`Raw_Campaigns` ×2). Meta's `Raw_Ads` alone has 6,457 rows × 30+
columns including JSON-blob columns up to 40 KB each. Total payload
of all 7 reads is in the tens of MB. Vercel's serverless function
default is 1024 MB / 10 s, and Sheets API has its own 10 MB
per-request response cap.

**Lesson:** when adding a new lookup reader, narrow the read scope to
just the columns you need (`A:E` not `A:ZZ`) and add a defensive
fallback so a 0-row result from one lookup degrades the page
gracefully instead of the whole thing erroring out. The current
implementation is already fail-soft (empty Map on error → "(unknown)"
in the joined output) but a smaller payload is still better.

**Detection rule:** any new sheet read added to `lib/sheets.ts`
should specify a column range tighter than `A:ZZ` if the tab is wide
or has JSON columns. Run `wc -l` on the tab's sample data and
estimate payload size — if it's > 5 MB, narrow the range.

---

## 2026-05-02 — Tailwind opacity utility on custom named colors needs verification

Wrote `bg-ok/10 text-ok` for delta pills. Tailwind v3 supports
opacity modifiers on named colors only when the color is defined in a
way that allows alpha channel computation. For colors defined as flat
hex strings in `tailwind.config.ts` (which is how this project does
it), `bg-ok/10` may or may not resolve depending on Tailwind version.

**Lesson:** when a new color tint is needed, prefer the
already-defined 50/100/200 scale steps over arbitrary opacity. We
have full 50→900 ramps for `shikho-indigo`, `shikho-magenta`,
`shikho-sunrise`, `shikho-coral` — use those instead of
`brand-color/10`. Reserves the opacity utility for surfaces where the
underlying token does support it (the `ink` scale does, the named
status hues `ok`/`warn`/`bad` are flat).

**Detection rule:** before using `text-X/N` or `bg-X/N`, check that
`X` is a stepped color (50…900) or a CSS-variable color. Status hues
like `ok`/`warn`/`bad` are not stepped — use the matching
`shikho-*-50` / `shikho-*-700` for tinted backgrounds with brand
text.

---

## 2026-05-02 — KpiCard signature evolution must be backward-compatible

Existing pages (Overview, Conversions) pass `accent` (hex string) to
KpiCard. Upgrading the component to add `delta` / `deltaAbs` /
`pillColor` semantics meant deciding between a prop rename (clean
but breaking) or aliasing (slightly noisy but safe).

**Lesson:** for shared components used by 3+ pages, always alias new
prop names through the legacy ones. The cost of two parallel names
in the props is far less than the cost of breaking a working page in
the same commit as the upgrade. The `accent` → `pillColor` aliasing
is recorded inline in the component's JSDoc so future readers
understand which is canonical.

**Detection rule:** before changing a prop name in `components/`,
`grep -rnE "ComponentName" app/` to count call sites. If > 1, alias.

---

## 2026-05-02 — Every UI commit needs all four documents updated

I shipped the v0.4 spend page and the design refactor without
updating LEARNINGS.md, DECISIONS.md, or even properly filling
CHANGELOG.md. The user noticed.

**Lesson:** the master `paid-ads-analytics/CLAUDE.md` rule is
explicit: "After any commit, proactively update docs before reporting
done. Update CHANGELOG.md, DECISIONS.md, LEARNINGS.md, and any
affected READMEs / architecture notes / runbooks." This applies to
the dashboard repo too. CHANGELOG = what shipped; DECISIONS =
tradeoffs worth remembering; LEARNINGS = gotchas worth pre-empting.

**Detection rule:** after `git commit`, check `git diff --stat HEAD~1`
for any file under `app/` or `components/` that changed. If yes and
no entries in CHANGELOG / DECISIONS / LEARNINGS were added, the
commit is incomplete — amend or follow-up commit before pushing.
