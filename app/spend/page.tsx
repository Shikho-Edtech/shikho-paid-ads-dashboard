// Spend Overview — v0.1.
//
// One page that answers three questions:
//   1. Where did the money go in this date range?
//   2. Is the split right across objectives / optimizations / ad signals?
//   3. What changed vs the prior period?
//
// Architecture:
//   - URL state for date range (?days=N or ?start=&end=). Same convention
//     as Overview so date-picker UX stays consistent.
//   - Comparison flag (?compare=1) toggles prior-period delta. When on,
//     KPIs and breakdowns show signed deltas; when off, just current.
//   - All rollups derive from EnrichedInsight rows (UnifiedInsight +
//     entity-tab joins for optimization + ad_signal + bid_strategy).
//   - Cross-platform charts NEVER merge buckets. A Meta "TRAFFIC"
//     bucket and a Google "TRAFFIC" bucket render as separate rows so
//     the UI doesn't fake taxonomy parity that doesn't exist.
//
// Currency: USD natively from both pipelines.

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
import type { EnrichedInsight, SpendBucket } from "@/lib/types";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/colors";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import StalenessBanner from "@/components/StalenessBanner";
import DateRangePicker from "@/components/DateRangePicker";
import SpendBucketBar from "@/components/SpendBucketBar";
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

  // Date range resolution mirrors Overview.
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

  // ── KPIs ────────────────────────────────────────────────────────
  const totalCur = totalSpend(current);
  const totalPrev = totalSpend(prior);
  const delta = compareOn ? totalCur - totalPrev : null;
  const deltaPct = compareOn && totalPrev > 0 ? (totalCur - totalPrev) / totalPrev : null;

  const dayCount = Math.max(
    1,
    Math.round(
      (new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86400000,
    ) + 1,
  );
  const avgDaily = totalCur / dayCount;

  const metaSpend = current.filter((r) => r.channel === "meta").reduce((s, r) => s + r.spend, 0);
  const googleSpend = totalCur - metaSpend;
  const metaShare = totalCur > 0 ? metaSpend / totalCur : 0;

  const spendingCamps = spendingCampaignCount(current);
  const top5Concentration = spendConcentration(current, 5);

  // ── Daily series (current + comparison overlay) ─────────────────
  const daily = dailySpendEnriched(current);

  // ── Dimension rollups ───────────────────────────────────────────
  // Objective = Meta campaign objective / Google channel_type
  const curObjective = bucketBy(current, (r) => r.objective);
  const prevObjective = compareOn ? bucketBy(prior, (r) => r.objective) : [];
  const objectiveBuckets = compareOn ? attachDelta(curObjective, prevObjective) : curObjective;

  // Optimization = Meta optimization_goal / Google ad_group type
  const curOpt = bucketBy(current, (r) => r.optimization);
  const prevOpt = compareOn ? bucketBy(prior, (r) => r.optimization) : [];
  const optBuckets = compareOn ? attachDelta(curOpt, prevOpt) : curOpt;

  // Ad signal = Meta conversion_specs[].action.type / Google ad_type
  const curSignal = bucketBy(current, (r) => r.ad_signal);
  const prevSignal = compareOn ? bucketBy(prior, (r) => r.ad_signal) : [];
  const signalBuckets = compareOn ? attachDelta(curSignal, prevSignal) : curSignal;

  // Campaign-level table (top 20 to keep DOM lean)
  const campTable = campaignSpendTable(current, compareOn ? prior : undefined).slice(0, 20);

  // ── Build link helpers (preserve days/start/end while toggling compare)
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        {/* Header */}
        <header>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-900">
            Spend Overview
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Where the money is going across Meta + Google, broken down by
            campaign objective, ad-group optimization, and ad-level signal.
          </p>
        </header>

        {/* Controls */}
        <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-ink-paper p-4">
          <DateRangePicker
            currentDays={appliedDays}
            currentStart={windowStart}
            currentEnd={windowEnd}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-muted font-semibold uppercase tracking-wide">
              Comparison
            </span>
            <Link
              href={compareOffHref}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                !compareOn
                  ? "bg-shikho-indigo-50 text-shikho-indigo-700"
                  : "text-ink-muted hover:text-ink-900"
              }`}
            >
              Off
            </Link>
            <Link
              href={compareOnHref}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                compareOn
                  ? "bg-shikho-indigo-50 text-shikho-indigo-700"
                  : "text-ink-muted hover:text-ink-900"
              }`}
            >
              vs prior {dayCount}d
            </Link>
            {compareOn && compare && (
              <span className="text-ink-muted">
                ({compare.start} → {compare.end})
              </span>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Total spend"
            value={fmtUSD(totalCur)}
            hint={
              compareOn && delta !== null
                ? `${delta >= 0 ? "+" : ""}${fmtUSD(delta)}${
                    deltaPct !== null ? ` · ${deltaPct >= 0 ? "+" : ""}${(deltaPct * 100).toFixed(1)}%` : ""
                  } vs prior`
                : `${dayCount}d window`
            }
            accent="#252F73"
          />
          <KpiCard
            label="Daily avg"
            value={fmtUSD(avgDaily)}
            hint={`across ${dayCount}d`}
            accent="#252F73"
          />
          <KpiCard
            label="Meta"
            value={fmtUSD(metaSpend)}
            hint={`${(metaShare * 100).toFixed(0)}% of total`}
            accent={CHANNEL_COLOR.meta}
            pillLabel="Meta"
          />
          <KpiCard
            label="Google"
            value={fmtUSD(googleSpend)}
            hint={`${((1 - metaShare) * 100).toFixed(0)}% of total`}
            accent={CHANNEL_COLOR.google}
            pillLabel="Google"
          />
          <KpiCard
            label="Spending campaigns"
            value={fmtNum(spendingCamps)}
            hint={`top 5 = ${(top5Concentration * 100).toFixed(0)}% of spend`}
            accent="#C02080"
          />
        </section>

        {/* Daily spend chart */}
        <section className="rounded-xl border border-ink-100 bg-ink-paper p-4 sm:p-5">
          <header className="mb-3">
            <h2 className="font-display text-base sm:text-lg font-semibold text-ink-900">
              Daily spend
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Stacked Meta + Google · {windowStart} → {windowEnd}
            </p>
          </header>
          <SpendChart data={daily} />
        </section>

        {/* Three breakdown panels */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SpendBucketBar
            buckets={objectiveBuckets}
            title="By campaign objective"
            subtitle="Meta: campaign.objective · Google: channel_type"
            showAdCount
          />
          <SpendBucketBar
            buckets={optBuckets}
            title="By optimization (ad-group level)"
            subtitle="Meta: adset.optimization_goal · Google: ad_group.type"
            showAdCount
          />
          <SpendBucketBar
            buckets={signalBuckets}
            title="By ad-level signal"
            subtitle="Meta: conversion_specs action_type · Google: ad.type"
            showAdCount
          />
        </section>

        {/* Cross-platform asymmetry note */}
        <aside className="rounded-lg border border-shikho-sunrise-200 bg-shikho-sunrise-50 p-3 text-xs text-shikho-sunrise-900 leading-snug">
          <strong className="font-semibold">A note on cross-platform parity.</strong>
          {" "}
          Meta&apos;s objective and optimization_goal don&apos;t map 1:1 to
          Google&apos;s channel_type and ad-group type. We render Meta and
          Google as separate buckets in each chart — even when the labels
          look similar — so a Meta &ldquo;TRAFFIC&rdquo; line and a Google
          &ldquo;SEARCH&rdquo; line never get implicitly compared.
        </aside>

        {/* Campaign-level table */}
        <section className="rounded-xl border border-ink-100 bg-ink-paper">
          <header className="p-4 sm:p-5 border-b border-ink-100">
            <h2 className="font-display text-base sm:text-lg font-semibold text-ink-900">
              Top campaigns
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Top 20 by spend · sorted descending
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-ink-50 text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                    Campaign
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                    Channel
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                    Objective
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                    Bid strategy
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                    Adsets
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                    Ads
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                    Spend
                  </th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                    Share
                  </th>
                  {compareOn && (
                    <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide">
                      Δ
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {campTable.length === 0 ? (
                  <tr>
                    <td
                      colSpan={compareOn ? 9 : 8}
                      className="px-3 py-6 text-center text-ink-muted"
                    >
                      No spend in the selected range.
                    </td>
                  </tr>
                ) : (
                  campTable.map((row) => (
                    <tr
                      key={`${row.channel}|${row.campaign_id}`}
                      className="border-t border-ink-100 hover:bg-ink-50/40"
                    >
                      <td className="px-3 py-2 align-top">
                        <span
                          className="font-medium text-ink-900 break-words"
                          title={row.campaign_name}
                        >
                          {row.campaign_name || "(unnamed)"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ background: CHANNEL_COLOR[row.channel] }}
                        >
                          {CHANNEL_LABEL[row.channel]}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-ink-secondary font-mono text-[11px] sm:text-xs">
                        {row.objective || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-ink-secondary font-mono text-[11px] sm:text-xs">
                        {row.bid_strategy || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums">
                        {fmtNum(row.ad_groups)}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums">
                        {fmtNum(row.ads)}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums font-semibold">
                        {fmtUSD(row.spend)}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums text-ink-muted">
                        {fmtPct(row.share)}
                      </td>
                      {compareOn && (
                        <td
                          className={`px-3 py-2 align-top text-right tabular-nums font-semibold ${
                            (row.delta || 0) >= 0
                              ? "text-shikho-sunrise-700"
                              : "text-shikho-magenta-700"
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
        </section>
      </main>
    </div>
  );
}
