// Spend Overview — v0.2 (design system pass).
//
// Single page that answers three questions:
//   1. Where did the money go in this date range?
//   2. Is the split right across objectives / optimizations / ad signals?
//   3. What changed vs the prior period?
//
// Architecture:
//   - URL state: ?days=N or ?start=&end= (same as Overview).
//   - ?compare=1 toggles prior-period delta.
//   - Reads enriched insights = Raw_Insights joined to Raw_AdSets,
//     Raw_AdGroups, Raw_Ads, Raw_Campaigns for optimization + ad_signal +
//     bid_strategy. Cross-platform charts NEVER merge buckets.
//
// Design notes (v0.2):
//   - Uses SectionCard from components/Card.tsx — Shikho v1.0 surface.
//   - PageHeader carries the data-as-of stamp from runStatus.
//   - KpiCard upgraded with Shikho indigo gradient + delta semantics.
//   - Channel-coded breakdowns; explicit cross-platform-asymmetry note.
//   - Mobile-first: 360px floor for every section.
//   - Data Status footer surfaces per-channel row counts so a silent
//     "Meta has 0 spend" issue is visible to the operator.

import {
  getEnrichedInsights,
  getRunStatus,
} from "@/lib/sheets";
import {
  filterEnrichedByDateRange,
  bucketBy,
  attachDelta,
  totalSpend,
  spendingCampaignCount,
  spendConcentration,
  dailySpendEnriched,
  priorPeriod,
  campaignSpendTable,
  fmtUSD,
  fmtPct,
  fmtNum,
  daysAgo,
  today,
} from "@/lib/aggregate";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/colors";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import StalenessBanner from "@/components/StalenessBanner";
import DateRangePicker from "@/components/DateRangePicker";
import SpendBucketBar from "@/components/SpendBucketBar";
import PageHeader from "@/components/PageHeader";
import { SectionCard } from "@/components/Card";
import Link from "next/link";

export const revalidate = 600; // 10 min ISR

interface PageProps {
  searchParams: Promise<{
    days?: string;
    start?: string;
    end?: string;
    compare?: string;
  }>;
}

export default async function SpendPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // ── Date-range resolution (mirrors Overview) ────────────────────
  let windowStart: string;
  let windowEnd: string;
  let appliedDays: number | null = null;

  if (sp.start && sp.end) {
    windowStart = sp.start;
    windowEnd = sp.end;
  } else {
    const n = sp.days ? Math.max(1, Math.min(365, parseInt(sp.days, 10) || 30)) : 30;
    windowStart = daysAgo(n);
    windowEnd = today();
    appliedDays = n;
  }

  const compareOn = sp.compare === "1" || sp.compare === "true";
  const compare = compareOn ? priorPeriod(windowStart, windowEnd) : null;

  const [enriched, runStatus] = await Promise.all([
    getEnrichedInsights(),
    getRunStatus(),
  ]);

  const current = filterEnrichedByDateRange(enriched, windowStart, windowEnd);
  const prior = compare
    ? filterEnrichedByDateRange(enriched, compare.start, compare.end)
    : [];

  // ── Per-channel splits ──────────────────────────────────────────
  const metaCur = current.filter((r) => r.channel === "meta");
  const googleCur = current.filter((r) => r.channel === "google");
  const metaSpend = metaCur.reduce((s, r) => s + r.spend, 0);
  const googleSpend = googleCur.reduce((s, r) => s + r.spend, 0);
  const totalCur = metaSpend + googleSpend;

  const metaPrev = prior.filter((r) => r.channel === "meta").reduce((s, r) => s + r.spend, 0);
  const googlePrev = prior.filter((r) => r.channel === "google").reduce((s, r) => s + r.spend, 0);
  const totalPrev = metaPrev + googlePrev;

  // Δ helpers
  const dPct = (cur: number, prev: number): number | undefined => {
    if (!compareOn) return undefined;
    if (prev <= 0) return cur > 0 ? 100 : undefined;
    return ((cur - prev) / prev) * 100;
  };
  const dAbs = (cur: number, prev: number): string | undefined => {
    if (!compareOn) return undefined;
    const diff = cur - prev;
    return `${diff >= 0 ? "+" : ""}${fmtUSD(diff)}`;
  };

  const dayCount = Math.max(
    1,
    Math.round(
      (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86400000,
    ) + 1,
  );
  const avgDaily = totalCur / dayCount;
  const metaShare = totalCur > 0 ? metaSpend / totalCur : 0;
  const googleShare = totalCur > 0 ? googleSpend / totalCur : 0;
  const spendingCamps = spendingCampaignCount(current);
  const top5Concentration = spendConcentration(current, 5);

  // ── Daily series ────────────────────────────────────────────────
  const daily = dailySpendEnriched(current);

  // ── Dimension rollups ───────────────────────────────────────────
  const curObjective = bucketBy(current, (r) => r.objective);
  const prevObjective = compareOn ? bucketBy(prior, (r) => r.objective) : [];
  const objectiveBuckets = compareOn ? attachDelta(curObjective, prevObjective) : curObjective;

  const curOpt = bucketBy(current, (r) => r.optimization);
  const prevOpt = compareOn ? bucketBy(prior, (r) => r.optimization) : [];
  const optBuckets = compareOn ? attachDelta(curOpt, prevOpt) : curOpt;

  const curSignal = bucketBy(current, (r) => r.ad_signal);
  const prevSignal = compareOn ? bucketBy(prior, (r) => r.ad_signal) : [];
  const signalBuckets = compareOn ? attachDelta(curSignal, prevSignal) : curSignal;

  // Top-20 campaigns
  const campTable = campaignSpendTable(current, compareOn ? prior : undefined).slice(0, 20);

  // ── Comparison toggle hrefs (preserve days/start/end) ────────────
  const baseQuery = new URLSearchParams();
  if (sp.start && sp.end) {
    baseQuery.set("start", sp.start);
    baseQuery.set("end", sp.end);
  } else if (appliedDays) {
    baseQuery.set("days", String(appliedDays));
  }
  const compareOnHref = (() => {
    const q = new URLSearchParams(baseQuery);
    q.set("compare", "1");
    return `/spend?${q.toString()}`;
  })();
  const compareOffHref = (() => {
    const q = new URLSearchParams(baseQuery);
    q.delete("compare");
    return `/spend${q.size ? "?" + q.toString() : ""}`;
  })();

  return (
    <div className="min-h-screen bg-brand-canvas">
      <StalenessBanner status={runStatus} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <PageHeader
          title="Spend Overview"
          subtitle="Where the money goes across Meta + Google, broken down by campaign objective, ad-group optimization, and ad-level signal. Cross-platform buckets stay separate — Meta and Google taxonomies don't map 1:1."
          metaLastRun={runStatus.meta_last_run_at}
          googleLastRun={runStatus.google_last_run_at}
          rightSlot={
            <div className="flex flex-col sm:items-end gap-2.5">
              <DateRangePicker
                currentDays={appliedDays}
                currentStart={windowStart}
                currentEnd={windowEnd}
              />
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-ink-muted font-semibold uppercase tracking-wider">
                  Compare
                </span>
                <Link
                  href={compareOffHref}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors duration-140 ${
                    !compareOn
                      ? "bg-shikho-indigo-50 text-shikho-indigo-700"
                      : "text-ink-muted hover:text-ink-secondary"
                  }`}
                >
                  Off
                </Link>
                <Link
                  href={compareOnHref}
                  className={`px-2 py-0.5 rounded-md font-medium transition-colors duration-140 ${
                    compareOn
                      ? "bg-shikho-indigo-50 text-shikho-indigo-700"
                      : "text-ink-muted hover:text-ink-secondary"
                  }`}
                >
                  vs prior {dayCount}d
                </Link>
              </div>
            </div>
          }
        />

        {/* KPI strip */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <KpiCard
            label="Total spend"
            value={fmtUSD(totalCur)}
            delta={dPct(totalCur, totalPrev)}
            deltaAbs={dAbs(totalCur, totalPrev)}
            hint={compareOn ? "vs prior" : `${dayCount}d window`}
          />
          <KpiCard
            label="Daily avg"
            value={fmtUSD(avgDaily)}
            hint={`across ${dayCount}d`}
          />
          <KpiCard
            label="Meta"
            value={fmtUSD(metaSpend)}
            delta={dPct(metaSpend, metaPrev)}
            deltaAbs={dAbs(metaSpend, metaPrev)}
            hint={`${(metaShare * 100).toFixed(0)}% of total`}
            pillLabel="Meta"
            pillColor={CHANNEL_COLOR.meta}
          />
          <KpiCard
            label="Google"
            value={fmtUSD(googleSpend)}
            delta={dPct(googleSpend, googlePrev)}
            deltaAbs={dAbs(googleSpend, googlePrev)}
            hint={`${(googleShare * 100).toFixed(0)}% of total`}
            pillLabel="Google"
            pillColor={CHANNEL_COLOR.google}
          />
          <KpiCard
            label="Spending campaigns"
            value={fmtNum(spendingCamps)}
            hint={`top 5 = ${(top5Concentration * 100).toFixed(0)}% of spend`}
          />
        </section>

        {/* Daily spend chart */}
        <div className="mb-6 sm:mb-8">
          <SectionCard
            title="Daily spend"
            subtitle={`Stacked Meta + Google · ${windowStart} → ${windowEnd}`}
            kind="observed"
          >
            <SpendChart data={daily} />
          </SectionCard>
        </div>

        {/* Three breakdown panels */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-8">
          <SectionCard
            title="By campaign objective"
            subtitle="Meta: campaign.objective · Google: channel_type"
            meta={`${objectiveBuckets.length} buckets`}
            kind="meta"
          >
            <SpendBucketBar buckets={objectiveBuckets} showAdCount />
          </SectionCard>
          <SectionCard
            title="By optimization"
            subtitle="Meta: adset.optimization_goal · Google: ad_group.type"
            meta={`${optBuckets.length} buckets`}
            kind="derived"
          >
            <SpendBucketBar buckets={optBuckets} showAdCount />
          </SectionCard>
          <SectionCard
            title="By ad-level signal"
            subtitle="Meta: conversion_specs.action_type · Google: ad.type"
            meta={`${signalBuckets.length} buckets`}
            kind="google"
          >
            <SpendBucketBar buckets={signalBuckets} showAdCount />
          </SectionCard>
        </section>

        {/* Cross-platform asymmetry note */}
        <aside
          className="mb-6 sm:mb-8 rounded-2xl border border-shikho-sunrise-200 bg-shikho-sunrise-50/60 px-5 py-4 text-xs leading-relaxed text-shikho-sunrise-900"
          role="note"
        >
          <strong className="font-semibold block mb-1">
            Cross-platform parity note
          </strong>
          Meta&apos;s objective and optimization_goal don&apos;t map 1:1 to
          Google&apos;s channel_type and ad-group type. Even when the labels
          look similar (e.g., both have &ldquo;TRAFFIC&rdquo;-flavoured
          buckets), the underlying meaning differs. Meta and Google buckets
          render as separate rows in every chart so a Meta line and a
          Google line never get implicitly compared.
        </aside>

        {/* Top campaigns */}
        <div className="mb-6 sm:mb-8">
          <SectionCard
            title="Top campaigns"
            subtitle="Top 20 by spend · click a column header sorts coming soon"
            meta={`${campTable.length} of ${spendingCamps}`}
          >
            <div className="-mx-5 sm:-mx-6 overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-ink-50/60 text-ink-muted">
                  <tr>
                    <th className="px-3 sm:px-5 py-2 text-left font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                      Campaign
                    </th>
                    <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                      Channel
                    </th>
                    <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                      Objective
                    </th>
                    <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] hidden md:table-cell">
                      Bid strategy
                    </th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] hidden sm:table-cell">
                      Adsets
                    </th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] hidden sm:table-cell">
                      Ads
                    </th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                      Spend
                    </th>
                    <th className="px-2 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] hidden sm:table-cell">
                      Share
                    </th>
                    {compareOn && (
                      <th className="px-2 sm:px-5 py-2 text-right font-semibold uppercase tracking-wider text-[10px] sm:text-[11px]">
                        Δ
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {campTable.length === 0 ? (
                    <tr>
                      <td
                        colSpan={compareOn ? 9 : 8}
                        className="px-5 py-8 text-center text-ink-muted text-sm"
                      >
                        No spend in the selected range.
                      </td>
                    </tr>
                  ) : (
                    campTable.map((row) => (
                      <tr
                        key={`${row.channel}|${row.campaign_id}`}
                        className="hover:bg-ink-50/40 transition-colors duration-140"
                      >
                        <td className="px-3 sm:px-5 py-2.5 align-top max-w-[220px] sm:max-w-md">
                          <span
                            className="font-medium text-shikho-indigo-900 break-words leading-snug block"
                            title={row.campaign_name}
                          >
                            {row.campaign_name || "(unnamed)"}
                          </span>
                          {/* On mobile, show ads/adsets count under the name to compensate for hidden columns */}
                          <span className="sm:hidden text-[10px] text-ink-muted block mt-0.5">
                            {fmtNum(row.ad_groups)} adsets · {fmtNum(row.ads)} ads
                          </span>
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white"
                            style={{ background: CHANNEL_COLOR[row.channel] }}
                          >
                            {CHANNEL_LABEL[row.channel]}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 align-top text-ink-secondary font-mono text-[10px] sm:text-[11px]">
                          {row.objective || "—"}
                        </td>
                        <td className="px-2 py-2.5 align-top text-ink-secondary font-mono text-[10px] sm:text-[11px] hidden md:table-cell">
                          {row.bid_strategy || "—"}
                        </td>
                        <td className="px-2 py-2.5 align-top text-right tabular-nums hidden sm:table-cell">
                          {fmtNum(row.ad_groups)}
                        </td>
                        <td className="px-2 py-2.5 align-top text-right tabular-nums hidden sm:table-cell">
                          {fmtNum(row.ads)}
                        </td>
                        <td className="px-2 py-2.5 align-top text-right tabular-nums font-semibold text-shikho-indigo-900">
                          {fmtUSD(row.spend)}
                        </td>
                        <td className="px-2 py-2.5 align-top text-right tabular-nums text-ink-muted hidden sm:table-cell">
                          {fmtPct(row.share)}
                        </td>
                        {compareOn && (
                          <td
                            className={`px-2 sm:px-5 py-2.5 align-top text-right tabular-nums font-semibold ${
                              (row.delta || 0) >= 0
                                ? "text-shikho-sunrise-700"
                                : "text-shikho-coral-700"
                            }`}
                          >
                            {row.delta !== undefined && Math.abs(row.delta) >= 0.5
                              ? `${row.delta >= 0 ? "+" : ""}${fmtUSD(row.delta)}`
                              : "—"}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Data status — surfaces silent issues like "Meta sheet returned 0 rows".
            When a channel has 0 spend in window despite the page rendering,
            this is the only signal that distinguishes "really no spend" from
            "sheet read failed silently". */}
        <SectionCard
          title="Data status"
          subtitle="Per-channel row counts after date filter — see /api/debug for full details"
          className="mb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div
              className={`rounded-xl border px-4 py-3 ${
                metaCur.length === 0
                  ? "border-shikho-coral-200 bg-shikho-coral-50/60"
                  : "border-ink-100 bg-ink-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className="font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: CHANNEL_COLOR.meta }}
                >
                  Meta
                </span>
                <span className="font-mono tabular-nums text-ink-muted">
                  {fmtNum(metaCur.length)} rows
                </span>
              </div>
              <div className="font-mono tabular-nums text-shikho-indigo-900 font-semibold">
                {fmtUSD(metaSpend)} spend in window
              </div>
              {metaCur.length === 0 && (
                <div className="text-shikho-coral-700 mt-1 leading-snug">
                  No Meta rows in this window. Open <code>/api/debug</code> to
                  check sheet ID, last pipeline run, and column-header drift.
                </div>
              )}
            </div>
            <div
              className={`rounded-xl border px-4 py-3 ${
                googleCur.length === 0
                  ? "border-shikho-coral-200 bg-shikho-coral-50/60"
                  : "border-ink-100 bg-ink-50/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className="font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: CHANNEL_COLOR.google }}
                >
                  Google
                </span>
                <span className="font-mono tabular-nums text-ink-muted">
                  {fmtNum(googleCur.length)} rows
                </span>
              </div>
              <div className="font-mono tabular-nums text-shikho-indigo-900 font-semibold">
                {fmtUSD(googleSpend)} spend in window
              </div>
              {googleCur.length === 0 && (
                <div className="text-shikho-coral-700 mt-1 leading-snug">
                  No Google rows in this window. Open <code>/api/debug</code>.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
