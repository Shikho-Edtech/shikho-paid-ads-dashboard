// Overview — single-page v1 of the paid-ads dashboard.
//
// What's here:
//   - KPI strip: total spend, Meta vs Google, conversions, CPA, ROAS
//   - Daily spend stacked chart (Meta + Google)
//   - Funnel-stage spend breakdown
//   - Top objectives table
//
// Data: server-side read of Raw_Insights from the Meta sheet + Google
// sheet via lib/sheets.ts. ISR 10 min so we don't hammer the Sheets API.
//
// Date window: trailing 30 days (BDT). Phase 4 will add a date picker.

import { getAllInsights, getRunStatus, channelHasData } from "@/lib/sheets";
import {
  filterByDateRange,
  summarizeKpis,
  dailySpend,
  objectiveBreakdown,
  funnelBreakdown,
  fmtBDT,
  fmtNum,
} from "@/lib/aggregate";
import { CHANNEL_COLOR } from "@/lib/colors";
import KpiCard from "@/components/KpiCard";
import SpendChart from "@/components/SpendChart";
import FunnelBar from "@/components/FunnelBar";
import ObjectiveTable from "@/components/ObjectiveTable";
import ChannelStatus from "@/components/ChannelStatus";

export const revalidate = 600; // 10 min ISR

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const [allInsights, runStatus] = await Promise.all([
    getAllInsights(),
    getRunStatus(),
  ]);

  // Trailing 30 days, in BDT (Sheets cells are already BDT-converted by
  // both pipelines per the cross-pipeline rule). We compute the window
  // server-side using UTC math; a one-day-of-overlap is fine for v1.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const filtered = filterByDateRange(allInsights, isoDay(windowStart), isoDay(now));

  const kpis = summarizeKpis(filtered);
  const daily = dailySpend(filtered);
  const funnel = funnelBreakdown(filtered);
  const objectives = objectiveBreakdown(filtered);

  const metaShare = kpis.total_spend > 0 ? kpis.meta_spend / kpis.total_spend : 0;
  const googleShare = kpis.total_spend > 0 ? kpis.google_spend / kpis.total_spend : 0;

  const metaHasData = channelHasData(filtered, "meta");
  const googleHasData = channelHasData(filtered, "google");

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <header className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-shikho-indigo-700 leading-tight">
            Paid Ads Overview
          </h1>
          <p className="text-sm text-ink-secondary">
            Cross-channel spend, funnel stage and results — last 30 days, BDT.
          </p>
        </div>
        <ChannelStatus
          status={runStatus}
          metaHasData={metaHasData}
          googleHasData={googleHasData}
        />
      </header>

      {/* Total spend strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Total Spend"
          value={fmtBDT(kpis.total_spend)}
          hint={`${fmtNum(filtered.length)} insight rows`}
        />
        <KpiCard
          label="Meta Spend"
          value={fmtBDT(kpis.meta_spend)}
          hint={`${(metaShare * 100).toFixed(0)}% of total`}
          accent={CHANNEL_COLOR.meta}
          pillLabel="Meta"
        />
        <KpiCard
          label="Google Spend"
          value={fmtBDT(kpis.google_spend)}
          hint={
            googleHasData
              ? `${(googleShare * 100).toFixed(0)}% of total`
              : "pipeline not yet running"
          }
          accent={CHANNEL_COLOR.google}
          pillLabel="Google"
        />
        <KpiCard
          label="Combined"
          value={fmtBDT(kpis.meta_spend + kpis.google_spend)}
          hint={
            googleHasData
              ? "Meta + Google"
              : "Meta only — Google still empty"
          }
        />
      </section>

      {/* Results strip */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <KpiCard
          label="Conversions"
          value={fmtNum(kpis.total_conversions)}
          hint="Sum of platform-attributed conversions"
        />
        <KpiCard
          label="Cost per Conversion"
          value={kpis.cpa > 0 ? fmtBDT(kpis.cpa) : "—"}
          hint={kpis.cpa > 0 ? "Total spend ÷ total conversions" : "No conversions in window"}
        />
        <KpiCard
          label="ROAS"
          value={kpis.roas > 0 ? `${kpis.roas.toFixed(2)}x` : "—"}
          hint={
            kpis.roas > 0
              ? `${fmtBDT(kpis.total_conversion_value)} / ${fmtBDT(kpis.total_spend)}`
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
            <span className="text-xs text-ink-muted">stacked, BDT</span>
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
              Mapped from objective via rule set — Phase 2 classifier will
              replace this.
            </p>
          </div>
          <FunnelBar data={funnel} />
        </div>
      </section>

      {/* Top objectives */}
      <section className="mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              Top objectives by spend
            </h2>
            <span className="text-xs text-ink-muted">top 12</span>
          </div>
          <ObjectiveTable rows={objectives} limit={12} />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-xs text-ink-muted pt-4 border-t border-ink-100 flex flex-col sm:flex-row sm:justify-between gap-2">
        <span>Shikho Paid Ads Analytics — v0.1</span>
        <span>
          Source: Raw_Insights from both pipeline sheets. Server-side ISR (10
          min revalidate).
        </span>
      </footer>
    </main>
  );
}
