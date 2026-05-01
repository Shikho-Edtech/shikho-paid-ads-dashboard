# DECISIONS — paid-ads-dashboard

Tradeoffs and architectural choices worth remembering. Pair with
`LEARNINGS.md` (the gotchas) and `CHANGELOG.md` (the what).

Mirrors the format of
`shikho-organic-social-analytics/organic-social-dashboard/DECISIONS.md`.
Each entry frames the alternatives considered, why we landed where we
landed, and any rules that flow forward from the choice.

---

## 2026-05-02 — Mirror the organic-social design system instead of inventing one

Three options for the /spend page's design language:

- **A.** Invent a paid-ads-specific design system from scratch.
- **B.** Use Tailwind defaults + Shikho hex tokens (no shared
  components) — the inline-styled-div approach we shipped in v0.1.
- **C.** Mirror the organic-social dashboard's component primitives
  (`Card`, `SectionCard`, `PageHeader`, `KpiCard` with indigo
  gradient) and brand docs (`BRAND.md`, `DESIGN_BRIEF.md`).

We picked **C**.

**Why:** the two dashboards are part of one Shikho analytics product
family. They share a primary reader (Shahriar), a brand system
(Shikho v1.0), a mobile floor (360 px), and a data-honesty
discipline. Inventing a second design language for paid-ads would
mean Shahriar context-switches between two visual grammars when he
moves from organic to paid analysis — a tax for no benefit.

**Rules going forward:**
1. Any new component idea is checked against
   `shikho-organic-social-analytics/organic-social-dashboard/components/`
   first. If there's prior art, port it. If not, build it here and
   consider whether organic-social would benefit too.
2. `BRAND.md` and `DESIGN_BRIEF.md` are mirrored from organic-social;
   adaptations are noted in-place. When the source diverges, this
   repo's copy wins for paid-ads scope.
3. The two dashboards may diverge on data layer (paid-ads has Meta +
   Google insights; organic-social has Facebook posts + reels) but
   never on visual grammar.

---

## 2026-05-02 — Cross-platform buckets are never merged

For any chart that breaks spend down by a dimension (campaign
objective, ad-group optimization, ad-level signal, etc.), Meta and
Google buckets render as separate rows even when their labels look
similar (e.g., both have a "TRAFFIC"-flavoured value).

Two alternatives we considered:

- **A.** Merge buckets when labels match. Sums two platforms into one
  row. Sorted combined chart is dense and clean.
- **B.** Keep buckets per platform. Two rows per matching label, one
  per platform, color-coded.

We picked **B**.

**Why:** Meta's `OUTCOME_TRAFFIC` is a campaign-level intent
declaration. Google's `SEARCH` is a `channel_type` attribute. They
are fundamentally different concepts and merging them implies a
semantic equivalence that doesn't exist. Sorting a merged chart by
combined spend then invites comparison ("Meta TRAFFIC has more spend
than Google SEARCH") that misleads more than it informs.

**Rules going forward:**
1. The `SpendBucket` type carries a `channel: Channel` field. The
   aggregator key is `${channel}|${key}`, not `key`.
2. Any new aggregator that takes `EnrichedInsight[]` and returns a
   single grouped result must produce per-channel rows, not merged.
3. Every cross-platform chart includes a visible asymmetry note
   explaining what each platform's labels mean and why they're not
   1:1. The note uses the calmer sunrise-50 aside, not a yellow
   warning strip.

---

## 2026-05-02 — Data Status footer is a load-bearing UX defense, not a debug tool

When a data source returns 0 rows, the symptom on the page is
indistinguishable from "really no spend in this window." The user
can't tell if Meta is silent because:
1. Meta cron failed (data is stale)
2. Date range is outside Meta's `date_min`/`date_max`
3. Sheet read errored silently
4. There genuinely was no Meta spend

We added a Data Status `<SectionCard>` at the bottom of /spend that
shows per-channel `current.filter(channel).length` + total spend in
window. When either is 0, the card border turns coral and points to
`/api/debug` for the deep dive.

Two alternatives we considered:

- **A.** Hide the Data Status surface — show only when something is
  wrong. Cleaner happy path.
- **B.** Always show it. Costs one card-row of vertical space per
  page; gives the operator a permanent "is the data flowing"
  reassurance.

We picked **B**.

**Why:** the dashboard is read on a phone, scrolling, often quickly.
A surface that only appears on failure trains the reader to skim past
the bottom of the page. A surface that's always there but visually
calm during success and visually loud during failure is read every
time and registers immediately when something is off. The cost (~80
px vertical on mobile) is acceptable.

**Rules going forward:**
1. Every page that joins data from > 1 source includes a Data Status
   footer.
2. The footer renders calmly on success (ink-100 border, ink-50
   background) and loudly on failure (coral-200 border, coral-50
   background). No ambiguous middle state.
3. The failure copy always names a follow-up action (e.g., "open
   `/api/debug`"). Never just "no rows" — give the operator the
   next click.

---

## 2026-05-02 — Lookup readers stay client-side for now (no Stats_Spend_Rollups tab yet)

The /spend page joins `Raw_Insights` to four entity tabs in the
dashboard (Meta `Raw_AdSets` + `Raw_Ads` + `Raw_Campaigns`, Google
`Raw_AdGroups` + `Raw_Ads` + `Raw_Campaigns`). Two alternatives
considered:

- **A.** Move the join to Python. Pipelines write a pre-joined
  `Stats_Spend_Rollups` tab. Dashboard reads one tab.
- **B.** Keep the join in TypeScript. Dashboard reads 7 tabs in
  parallel and joins in memory.

We picked **B** for v0.4 with a path to **A** later.

**Why:** option **A** is the cleaner architecture per the master
CLAUDE.md ("Heavy stats and joins live in Python"). But it requires
spec'ing a new sheet schema, writing the rollup script, adding it to
both pipelines' daily cron, validating cross-pipeline compatibility,
and shipping the dashboard read change in lockstep. That's
multi-week work for a v0.4 page.

The v0.4 in-memory join is honest: each dimension lookup is small
(<10K rows on the entity tabs), the merges are O(n), the
`getEnrichedInsights()` function is fail-soft if any lookup returns
empty. It works today and Vercel's 10 s function budget covers it
for the current data size.

**Migration trigger to A:** when total entity-tab rows cross 50K
(Shikho today: ~10K) OR when /spend p95 latency on Vercel exceeds
4 seconds. Until then, B is good enough.

**Rules going forward:**
1. New "join more entity data" requests for /spend stay in
   TypeScript until the migration trigger fires.
2. When migration fires, the new `Stats_Spend_Rollups` tab schema
   gets defined in `../../CONTRACTS.md` first, written by both
   pipelines, then read by /spend in a single dashboard commit.
3. Until migration: prefer narrowing the entity-tab read range
   (`A:E` not `A:ZZ`) over widening the join surface.

---

## 2026-05-02 — KpiCard upgrade aliases legacy props instead of renaming

Adding `delta` / `deltaAbs` / `pillColor` to KpiCard required
deciding what to do with the legacy `accent` prop used by Overview
and Conversions pages.

- **A.** Rename `accent` → `pillColor`. Update all callers in the
  same commit. Cleaner.
- **B.** Add `pillColor` as the new canonical name; keep `accent` as
  an alias. Slightly noisier prop type but safe.

We picked **B**.

**Why:** the upgrade was scoped to /spend. Renaming `accent` would
have meant editing two unrelated pages in the same commit, which
expands the blast radius for a small visual change. Aliasing is a
4-line addition: both names resolve to the same internal variable.
The component's JSDoc records that `pillColor` is canonical and
`accent` is legacy. When the next person touches Overview or
Conversions, they can migrate that page's call sites — no flag day
required.

**Rules going forward:**
1. Component prop renames default to alias-and-deprecate, not
   rename-and-break. Document which name is canonical.
2. Migrate legacy callers opportunistically (next time you touch the
   page for another reason), not in a flag day.
3. After 3+ months of zero legacy usage, drop the alias in a cleanup
   commit.

---

## 2026-05-02 — `?compare=1` is the comparison toggle, not a separate page

The /spend page handles "vs prior period" via a URL flag rather than
a separate `/spend/compare` route or a global comparison context.

**Why:** comparison is a presentation choice for the same dataset,
not a different question. Bookmarkable URLs make Shahriar's
"daily — toggle compare on, glance at deltas" workflow one click
instead of three. The comparison resolver `priorPeriod(start, end)`
is pure (equal-length immediately-prior window), so the URL is
self-describing.

**Alternatives considered:**

- A separate `/spend/compare` route — duplicates layout, divergence
  risk
- React state for comparison — not bookmarkable, breaks back-button
  usability
- A persisted user preference — over-engineered for a one-user
  product

**Rules going forward:**
1. Pages that have a "compare to prior" toggle use `?compare=1`.
2. The comparison resolver is always equal-length immediately-prior
   (matching ad-platform UI conventions). Custom compare ranges are
   a future feature; not v0.4.
3. The comparison toggle UI lives in the PageHeader's `rightSlot`,
   under the date picker.
