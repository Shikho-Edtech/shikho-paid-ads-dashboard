// Overview — v0.2.
//
// Reads `?days=N` (preset) or `?start=YYYY-MM-DD&end=YYYY-MM-DD` (custom)
// from the URL. Falls back to trailing 30 days. Server-side ISR (10 min).
//
// Sections:
//   - StalenessBanner (per-channel, surfaces only when stale)
//   - DateRangePicker (URL-state driven)
//   - KPI strip (total / Meta / Google / combined)
//   - Results strip (conversions / CPA / ROAS)
//   - Daily spend stacked chart
//   - Funnel-stage mix (rule-derived from objective until Phase 2 classifier)
//   - HierarchyExplorer — Campaign / Ad Group / Ad drill-down with platform
//     and objective filters. The verification-it-all-works view.
//   - ChannelStatus chips at the bottom
//
// Currency: USD throughout. Both Meta and Google return account-currency
// values natively for Shikho (USD).

import {
  getAllInsights,
  getRunStatus,
  channelHasData,
  getConversionActions,
  getConversionInsights,
} from "@/lib/sheets";
import {
  filterByDateRange,
  summarizeKpis,
  dailySpend,
  objectiveBreakdown,
  funnelBreakdown,
  fmtUSD,
  fmtNum,
  daysAgo,
  today,
  filterConversionsByDateRange,
  filterPrimaryConversions,
  sumConversions,
} from "@/lib/aggregate";
import { CHANNEL_COLOR } from "@/lib/colors";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import FunnelBar from "@/components/FunnelBar";
import ObjectiveTable from "@/components/ObjectiveTable";
import ChannelStatus from "@/components/ChannelStatus";
import StalenessBanner from "@/components/StalenessBanner";
import HierarchyExplorer from "@/components/HierarchyExplorer";
import DateRangePicker from "@/components/DateRangePicker";

export const revalidate = 600; // 10 min ISR

interface PageProps {
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // Resolve the date window from URL params.
  // Priority: explicit start/end > days preset > default 30d.
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

  const [allInsights, runStatus, convActions, convInsightsAll] = await Promise.all([
    getAllInsights(),
    getRunStatus(),
    getConversionActions(),
    getConversionInsights(),
  ]);

  const filtered = filterByDateRange(allInsights, windowStart, windowEnd);

  const kpis = summarizeKpis(filtered);
  const daily = dailySpend(filtered);
  const funnel = funnelBreakdown(filtered);
  const objectives = objectiveBreakdown(filtered);

  // Primary conversions (Google side) — filtered to actions where
  // primary_for_goal=TRUE. This is what Smart Bidding sees and what
  // we should show as the headline business KPI, NOT the inflated
  // metrics.conversions sum that includes session_start etc.
  const convInWindow = filterConversionsByDateRange(
    convInsightsAll,
    windowStart,
    windowEnd,
  );
  const primaryConv = filterPrimaryConversions(convInWindow, convActions);
  const primarySum = sumConversions(primaryConv);
  // Headline KPI = Google primary conversions + Meta-side conversions
  // (Meta still uses the actions[] heuristic — until Raw_Action_Events
  // ships per the Meta audit). This understates Meta but doesn't
  // hugely overstate like the all-conversions number did.
  const metaConvFromInsights = filtered
    .filter((r) => r.channel === "meta")
    .reduce((s, r) => s + r.conversions, 0);
  const metaConvValueFromInsights = filtered
    .filter((r) => r.channel === "meta")
    .reduce((s, r) => s + r.conversion_value, 0);
  const headlineConversions = primarySum.conversions + metaConvFromInsights;
  const headlineConvValue = primarySum.conversions_value + metaConvValueFromInsights;
  const headlineCpa =
    headlineConversions > 0 ? kpis.total_spend / headlineConversions : 0;
  const headlineRoas =
    kpis.total_spend > 0 ? headlineConvValue / kpis.total_spend : 0;

  const metaShare = kpis.total_spend > 0 ? kpis.meta_spend / kpis.total_spend : 0;
  const googleShare = kpis.total_spend > 0 ? kpis.google_spend / kpis.total_spend : 0;

  const metaHasData = channelHasData(filtered, "meta");
  const googleHasData = channelHasData(filtered, "google");

  const expectedChannels: ("meta" | "google")[] = googleHasData
    ? ["meta", "google"]
    : ["meta"];

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Staleness banner */}
      <StalenessBanner status={runStatus} channelsExpected={expectedChannels} />

      {/* Header */}
      <header className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-shikho-indigo-700 leading-tight">
              Paid Ads Overview
            </h1>
            <p className="text-sm text-ink-secondary">
              Cross-channel spend, results and funnel mix — USD, account-currency from each platform.
            </p>
          </div>
          <ChannelStatus
            status={runStatus}
            metaHasData={metaHasData}
            googleHasData={googleHasData}
          />
        </div>
        <DateRangePicker
          currentDays={appliedDays}
          currentStart={windowStart}
          currentEnd={windowEnd}
        />
      </header>

      {/* Spend strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Total Spend"
          value={fmtUSD(kpis.total_spend)}
          hint={`${fmtNum(filtered.length)} insight rows`}
        />
        <KpiCard
          label="Meta Spend"
          value={fmtUSD(kpis.meta_spend)}
          hint={`${(metaShare * 100).toFixed(0)}% of total`}
          accent={CHANNEL_COLOR.meta}
          pillLabel="Meta"
        />
        <KpiCard
          label="Google Spend"
          value={fmtUSD(kpis.google_spend)}
          hint={
            googleHasData
              ? `${(googleShare * 100).toFixed(0)}% of total`
              : "no data in window"
          }
          accent={CHANNEL_COLOR.google}
          pillLabel="Google"
        />
        <KpiCard
          label="Combined"
          value={fmtUSD(kpis.meta_spend + kpis.google_spend)}
          hint="Meta + Google"
        />
      </section>

      {/* Results strip — primary conversions (Google primary_for_goal +
          Meta heuristic) NOT the inflated total. See /conversions for
          the full per-action drilldown. */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <KpiCard
          label="Primary Conversions"
          value={fmtNum(headlineConversions)}
          hint={`Google primary + Meta. Drill down on /conversions`}
        />
        <KpiCard
          label="Cost per Conversion"
          value={headlineCpa > 0 ? fmtUSD(headlineCpa) : "—"}
          hint={headlineCpa > 0 ? "Total spend ÷ primary conversions" : "No primary conversions"}
        />
        <KpiCard
          label="ROAS"
          value={headlineRoas > 0 ? `${headlineRoas.toFixed(2)}x` : "—"}
          hint={
            headlineRoas > 0
              ? `${fmtUSD(headlineConvValue)} / ${fmtUSD(kpis.total_spend)}`
              : "No conversion value reported"
          }
        />
      </section>

      {/* Daily spend chart */}
      <section className="mb-6 sm:mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              Daily spend
            </h2>
            <span className="text-xs text-ink-muted">stacked, USD</span>
          </div>
          <SpendChart data={daily} />
        </div>
      </section>

      {/* Funnel breakdown */}
      <section className="mb-6 sm:mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex flex-col gap-1 mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              Funnel stage mix
            </h2>
            <p className="text-xs text-ink-muted">
              Rule-mapped from objective — Phase 2 classifier will replace this.
            </p>
          </div>
          <FunnelBar data={funnel} />
        </div>
      </section>

      {/* Hierarchy explorer */}
      <section className="mb-6 sm:mb-8">
        <HierarchyExplorer rows={filtered} />
      </section>

      {/* Top objectives — kept as a quick orientation table even though
          HierarchyExplorer covers it. Useful as a always-visible summary. */}
      <section className="mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              Top objectives by spend
            </h2>
            <span className="text-xs text-ink-muted">all platforms</span>
          </div>
          <ObjectiveTable rows={objectives} limit={12} />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-xs text-ink-muted pt-4 border-t border-ink-100 flex flex-col sm:flex-row sm:justify-between gap-2">
        <span>Shikho Paid Ads Analytics — v0.2</span>
        <span>
          Source: Raw_Insights from both pipeline sheets · ISR 10 min · USD throughout
        </span>
      </footer>
    </main>
  );
}
