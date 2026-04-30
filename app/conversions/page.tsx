// /conversions — per-conversion-action drill-down.
//
// Splits the inflated "Conversions: 2.3M" number on the overview into
// one row per conversion event (Trial Start / Purchase / Signup /
// session_start app event / etc), with category + primary_for_goal
// flag from the Raw_Conversion_Actions lookup.
//
// Date window: trailing 30d (URL ?days=N).
//
// Read sources:
//   - Raw_Conversion_Actions (Google Ads sheet): event metadata
//   - Raw_Insights_Conversions (Google Ads sheet): ad × date × event
//
// Meta has actions[] JSON inside Raw_Insights but no parallel split;
// the audit's Raw_Action_Events long-format is a future batch.

import {
  getConversionActions,
  getConversionInsights,
  getRunStatus,
} from "@/lib/sheets";
import {
  filterConversionsByDateRange,
  byConversionAction,
  filterPrimaryConversions,
  sumConversions,
  fmtUSD,
  fmtNum,
  daysAgo,
  today,
} from "@/lib/aggregate";
import KpiCard from "@/components/KpiCard";
import StalenessBanner from "@/components/StalenessBanner";
import DateRangePicker from "@/components/DateRangePicker";

export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}

export default async function ConversionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

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

  const [actions, allInsights, runStatus] = await Promise.all([
    getConversionActions(),
    getConversionInsights(),
    getRunStatus(),
  ]);

  const filtered = filterConversionsByDateRange(allInsights, windowStart, windowEnd);
  const primary = filterPrimaryConversions(filtered, actions);
  const primarySum = sumConversions(primary);
  const allSum = sumConversions(filtered);
  const stats = byConversionAction(filtered, actions);

  const primaryActionCount = actions.filter((a) => a.primary_for_goal).length;
  const totalActionCount = actions.length;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <StalenessBanner status={runStatus} channelsExpected={["google"]} />

      <header className="flex flex-col gap-3 mb-6 sm:mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-shikho-indigo-700 leading-tight">
            Conversions — per-action drill-down
          </h1>
          <p className="text-sm text-ink-secondary">
            Splits aggregate conversions into the underlying events.
            Google Ads data only — Meta drill-down ships in a future batch.
          </p>
        </div>
        <DateRangePicker
          currentDays={appliedDays}
          currentStart={windowStart}
          currentEnd={windowEnd}
        />
      </header>

      {/* KPI strip — primary vs all */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Primary Conversions"
          value={fmtNum(primarySum.conversions)}
          hint={`${primaryActionCount} action(s) · primary_for_goal=TRUE`}
        />
        <KpiCard
          label="Primary Conv Value"
          value={fmtUSD(primarySum.conversions_value)}
          hint="Smart Bidding sees this number"
        />
        <KpiCard
          label="All Conversions"
          value={fmtNum(allSum.all_conversions)}
          hint={`${totalActionCount} action(s) total · includes secondary + view-through`}
        />
        <KpiCard
          label="All Conv Value"
          value={fmtUSD(allSum.conversions_value)}
          hint="Sum across every conversion_action firing"
        />
      </section>

      <p className="text-xs text-ink-muted mb-4 leading-relaxed">
        Why two numbers: <strong>Primary Conversions</strong> = events
        flagged <code>primary_for_goal=TRUE</code> on the platform side
        — what Smart Bidding optimizes against and the business-relevant
        count. <strong>All Conversions</strong> = every conversion_action
        that fired, including secondary/observe-only events (page views,
        session starts, etc) plus view-through. Use Primary as the
        headline business KPI; use All as a sanity check on tracking
        completeness.
      </p>

      {/* Per-action table */}
      <section className="mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              Per conversion action — {windowStart} → {windowEnd}
            </h2>
            <span className="text-xs text-ink-muted">
              {fmtNum(stats.length)} action(s) firing
            </span>
          </div>
          <PerActionTable rows={stats} />
        </div>
      </section>

      {/* Lookup table — every defined conversion action, even non-firing */}
      <section className="mb-8">
        <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-ink-900">
              All defined conversion actions
            </h2>
            <span className="text-xs text-ink-muted">
              {fmtNum(actions.length)} defined · {fmtNum(primaryActionCount)} primary
            </span>
          </div>
          <DefinedActionsTable actions={actions} />
        </div>
      </section>

      <footer className="text-xs text-ink-muted pt-4 border-t border-ink-100 flex flex-col sm:flex-row sm:justify-between gap-2">
        <span>Source: Raw_Conversion_Actions + Raw_Insights_Conversions (Google sheet)</span>
        <span>ISR 10 min</span>
      </footer>
    </main>
  );
}

// ─── Per-action table ─────────────────────────────────────────────

import type { ConversionActionStats, ConversionAction } from "@/lib/types";

function PerActionTable({ rows }: { rows: ConversionActionStats[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        No conversion-action data in window.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted border-b border-ink-100">
            <th className="py-2 pr-3 font-semibold">Action</th>
            <th className="py-2 px-3 font-semibold">Category</th>
            <th className="py-2 px-3 font-semibold">Primary</th>
            <th className="py-2 px-3 font-semibold text-right">Conversions</th>
            <th className="py-2 px-3 font-semibold text-right">Conv. Value</th>
            <th className="py-2 pl-3 font-semibold text-right">All Conv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.resource_name}
              className={`border-b border-ink-100/60 ${
                r.primary_for_goal ? "" : "opacity-70"
              }`}
            >
              <td className="py-2 pr-3 font-medium text-ink-900 max-w-[280px] truncate">
                {r.name}
                <span className="block text-[10px] text-ink-muted font-normal tabular-nums">
                  ID {r.conversion_action_id}
                </span>
              </td>
              <td className="py-2 px-3">
                <CategoryPill category={r.category} />
              </td>
              <td className="py-2 px-3">
                {r.primary_for_goal ? (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-shikho-indigo-50 text-shikho-indigo-700">
                    Primary
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-muted">secondary</span>
                )}
              </td>
              <td className="py-2 px-3 text-right tabular-nums font-semibold">
                {fmtNum(r.conversions)}
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                {fmtUSD(r.conversions_value)}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-ink-secondary">
                {fmtNum(r.all_conversions)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DefinedActionsTable({ actions }: { actions: ConversionAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        No conversion actions defined yet.
      </div>
    );
  }
  // Primary first, then by name.
  const sorted = [...actions].sort((a, b) => {
    if (a.primary_for_goal !== b.primary_for_goal) {
      return a.primary_for_goal ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: 720 }}>
        <thead>
          <tr className="text-left text-ink-muted border-b border-ink-100">
            <th className="py-2 pr-3 font-semibold">Name</th>
            <th className="py-2 px-3 font-semibold">Category</th>
            <th className="py-2 px-3 font-semibold">Type</th>
            <th className="py-2 px-3 font-semibold">Status</th>
            <th className="py-2 px-3 font-semibold">Primary</th>
            <th className="py-2 pl-3 font-semibold">Attribution</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.resource_name} className="border-b border-ink-100/60">
              <td className="py-2 pr-3 font-medium text-ink-900 max-w-[280px] truncate">
                {a.name}
                <span className="block text-[10px] text-ink-muted font-normal tabular-nums">
                  ID {a.conversion_action_id}
                </span>
              </td>
              <td className="py-2 px-3">
                <CategoryPill category={a.category} />
              </td>
              <td className="py-2 px-3 text-xs text-ink-secondary truncate max-w-[180px]">
                {a.type}
              </td>
              <td className="py-2 px-3 text-xs">
                <StatusPill status={a.status} />
              </td>
              <td className="py-2 px-3">
                {a.primary_for_goal ? (
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-shikho-indigo-50 text-shikho-indigo-700">
                    Primary
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-muted">—</span>
                )}
              </td>
              <td className="py-2 pl-3 text-xs text-ink-secondary truncate max-w-[160px]">
                {a.attribution_model || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Category color map — derived from Google's enum.
const CATEGORY_COLORS: Record<string, string> = {
  PURCHASE: "#10A36C",
  LEAD: "#304090",
  SIGNUP: "#C02080",
  PAGE_VIEW: "#B6BBC8",
  ADD_TO_CART: "#E0A010",
  BEGIN_CHECKOUT: "#E0A010",
  SUBSCRIBE_PAID: "#10A36C",
  DOWNLOAD: "#4F5EAE",
  PHONE_CALL_LEAD: "#304090",
  IMPORTED_LEAD: "#304090",
  SUBMIT_LEAD_FORM: "#304090",
  STORE_VISIT: "#10A36C",
  STORE_SALE: "#10A36C",
  DEFAULT: "#646A7E",
};

function CategoryPill({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.DEFAULT;
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: `${color}1A`, color }}
    >
      {category || "—"}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "ENABLED";
  return (
    <span
      className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
        ok
          ? "bg-shikho-indigo-50 text-shikho-indigo-700"
          : "bg-ink-100 text-ink-muted"
      }`}
    >
      {status || "—"}
    </span>
  );
}
