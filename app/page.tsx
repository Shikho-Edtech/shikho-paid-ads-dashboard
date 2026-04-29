// Pure-numbers view. No KPI cards, no charts, no pickers — just dense
// statistical tables.
//
// Layout (top → bottom):
//   1. Headline summary — overall + per-platform totals
//   2. Spend distribution per platform (sum/mean/median/p25/p75/p95/max/stddev/CV/Gini)
//   3. By Platform × Funnel stage
//   4. By Platform × Objective
//   5. By Campaign (top 30 by spend, with stats)
//   6. By Ad Group / AdSet (top 30)
//   7. By Ad (top 30)
//   8. By Day
//
// Date range via URL: `?days=N` (preset) or `?start=&end=` (custom).
// Default trailing 30 days. Bookmarkable, shareable.

import { getAllInsights, getRunStatus } from "@/lib/sheets";
import {
  filterByDateRange,
  byCampaign,
  byAdGroup,
  byAd,
  fmtUSD,
  fmtNum,
  daysAgo,
  today,
} from "@/lib/aggregate";
import { summarize, percentile, sum, mean } from "@/lib/stats";
import type {
  UnifiedInsight,
  Channel,
  FunnelStage,
} from "@/lib/types";

export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ days?: string; start?: string; end?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmt2(n: number): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function fmtPct(n: number, digits = 2): string {
  if (!isFinite(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const h = Math.floor((Date.now() - t) / 3600000);
  if (h < 1) return "<1h";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Channel-row builder: applies a filter, computes everything caller needs.
function rowsFor(rows: UnifiedInsight[], channel?: Channel): UnifiedInsight[] {
  return channel ? rows.filter((r) => r.channel === channel) : rows;
}

// Build a per-group statistical row — used at the campaign / ad group / ad
// level. Aggregates over the underlying insights, then computes ratios.
interface GroupStats {
  group_label: string;
  group_id: string;
  channel: Channel;
  objective: string;
  funnel_stage: FunnelStage | null;
  // Aggregated totals
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  // Ratios
  cpa: number;
  cpc: number;
  cpm: number;
  ctr: number;
  cvr: number;
  roas: number;
  // Distribution shape (across the rows that fed this group, if multi-day)
  daily_spend_p50: number;
  daily_spend_p95: number;
}

// ─── Page ─────────────────────────────────────────────────────────

export default async function StatsPage({ searchParams }: PageProps) {
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

  const [allInsights, runStatus] = await Promise.all([
    getAllInsights(),
    getRunStatus(),
  ]);

  const filtered = filterByDateRange(allInsights, windowStart, windowEnd);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8 text-sm tabular-nums">
      <Header
        windowStart={windowStart}
        windowEnd={windowEnd}
        appliedDays={appliedDays}
        rowCount={filtered.length}
        runStatus={runStatus}
      />

      <HeadlineSummary rows={filtered} />

      <SpendDistribution rows={filtered} />

      <PlatformFunnel rows={filtered} />

      <PlatformObjective rows={filtered} />

      <GroupStatsTable
        title="By Campaign — top 30"
        rows={filtered}
        groupFn={byCampaign}
        keyName="campaign_id"
        labelName="campaign_name"
      />

      <GroupStatsTable
        title="By Ad Group / AdSet — top 30"
        rows={filtered}
        groupFn={byAdGroup}
        keyName="ad_group_id"
        labelName="ad_group_name"
      />

      <GroupStatsTable
        title="By Ad — top 30"
        rows={filtered}
        groupFn={byAd}
        keyName="ad_id"
        labelName="ad_name"
      />

      <DailySeries rows={filtered} />

      <footer className="text-xs text-ink-muted pt-4 border-t border-ink-100">
        Pure-numbers view · USD · {fmtNum(filtered.length)} insight rows in window ·
        ISR 10 min
      </footer>
    </main>
  );
}

// ─── Header ───────────────────────────────────────────────────────

function Header({
  windowStart,
  windowEnd,
  appliedDays,
  rowCount,
  runStatus,
}: {
  windowStart: string;
  windowEnd: string;
  appliedDays: number | null;
  rowCount: number;
  runStatus: any;
}) {
  // Inline preset links — pure URL params, no client component.
  const presets = [7, 14, 30, 60, 90];
  return (
    <header className="flex flex-col gap-2 pb-4 border-b border-ink-100">
      <h1 className="text-xl font-bold text-ink-900">Paid Ads — statistics</h1>
      <div className="flex flex-wrap gap-2 items-center text-xs text-ink-muted">
        <span className="text-ink-700 font-semibold">window:</span>
        {presets.map((d) => {
          const active = appliedDays === d;
          return (
            <a
              key={d}
              href={`?days=${d}`}
              className={`px-2 py-0.5 rounded border ${
                active
                  ? "bg-ink-900 text-white border-ink-900"
                  : "border-ink-200 hover:bg-ink-50 text-ink-700"
              }`}
            >
              {d}d
            </a>
          );
        })}
        <span className="text-ink-muted">
          {windowStart} → {windowEnd} · {fmtNum(rowCount)} rows
        </span>
        <span className="ml-auto text-ink-muted">
          meta: last run {ago(runStatus.meta_last_run_at)} · google: last run{" "}
          {ago(runStatus.google_last_run_at)}
        </span>
      </div>
    </header>
  );
}

// ─── 1. Headline summary ──────────────────────────────────────────

function HeadlineSummary({ rows }: { rows: UnifiedInsight[] }) {
  const all = rowsFor(rows);
  const meta = rowsFor(rows, "meta");
  const google = rowsFor(rows, "google");

  const totals = (arr: UnifiedInsight[]) => {
    const spend = sum(arr.map((r) => r.spend));
    const impressions = sum(arr.map((r) => r.impressions));
    const clicks = sum(arr.map((r) => r.clicks));
    const conversions = sum(arr.map((r) => r.conversions));
    const value = sum(arr.map((r) => r.conversion_value));
    return {
      n: arr.length,
      spend,
      impressions,
      clicks,
      conversions,
      value,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cvr: clicks > 0 ? conversions / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? value / spend : 0,
    };
  };

  const a = totals(all);
  const m = totals(meta);
  const g = totals(google);

  return (
    <Section title="Headline — totals + ratios">
      <table className="w-full text-xs">
        <thead>
          <Tr head>
            <Th>scope</Th>
            <Th right>rows</Th>
            <Th right>spend</Th>
            <Th right>impr</Th>
            <Th right>clicks</Th>
            <Th right>conv</Th>
            <Th right>conv $</Th>
            <Th right>cpm</Th>
            <Th right>cpc</Th>
            <Th right>ctr</Th>
            <Th right>cvr</Th>
            <Th right>cpa</Th>
            <Th right>roas</Th>
          </Tr>
        </thead>
        <tbody>
          <SummaryRow label="all" stats={a} />
          <SummaryRow label="meta" stats={m} />
          <SummaryRow label="google" stats={g} />
        </tbody>
      </table>
    </Section>
  );
}

function SummaryRow({ label, stats }: { label: string; stats: any }) {
  return (
    <Tr>
      <Td className="font-semibold uppercase tracking-wider text-[10px]">{label}</Td>
      <Td right>{fmtNum(stats.n)}</Td>
      <Td right strong>
        {fmtUSD(stats.spend)}
      </Td>
      <Td right>{fmtNum(stats.impressions)}</Td>
      <Td right>{fmtNum(stats.clicks)}</Td>
      <Td right>{fmtNum(stats.conversions)}</Td>
      <Td right>{fmtUSD(stats.value)}</Td>
      <Td right>{fmtUSD(stats.cpm)}</Td>
      <Td right>{fmtUSD(stats.cpc)}</Td>
      <Td right>{fmtPct(stats.ctr)}</Td>
      <Td right>{fmtPct(stats.cvr)}</Td>
      <Td right>{stats.cpa > 0 ? fmtUSD(stats.cpa) : "—"}</Td>
      <Td right>{stats.roas > 0 ? `${stats.roas.toFixed(2)}x` : "—"}</Td>
    </Tr>
  );
}

// ─── 2. Spend distribution per platform ───────────────────────────

function SpendDistribution({ rows }: { rows: UnifiedInsight[] }) {
  // Spend per row in the underlying insight set — useful for "what does
  // a typical insight row look like" but maybe more useful per ad-group
  // since one ad × one day is a row. We compute both: per-row and
  // per-campaign aggregations.
  const tablesByLevel = [
    { label: "row-level (per ad × day)", spendArr: rows.map((r) => r.spend) },
    { label: "per campaign", spendArr: byCampaign(rows).map((c) => c.spend) },
    { label: "per ad group", spendArr: byAdGroup(rows).map((c) => c.spend) },
    { label: "per ad", spendArr: byAd(rows).map((c) => c.spend) },
  ];

  return (
    <Section title="Spend distribution — math summary">
      <table className="w-full text-xs">
        <thead>
          <Tr head>
            <Th>aggregate level</Th>
            <Th right>n</Th>
            <Th right>sum</Th>
            <Th right>mean</Th>
            <Th right>median</Th>
            <Th right>stddev</Th>
            <Th right>cv</Th>
            <Th right>min</Th>
            <Th right>p25</Th>
            <Th right>p75</Th>
            <Th right>p95</Th>
            <Th right>max</Th>
            <Th right>gini</Th>
            <Th right>top10%</Th>
          </Tr>
        </thead>
        <tbody>
          {tablesByLevel.map(({ label, spendArr }) => {
            const s = summarize(spendArr);
            const positive = spendArr.filter((x) => x > 0);
            const top10pct = Math.max(1, Math.floor(positive.length / 10));
            const sorted = [...positive].sort((a, b) => b - a);
            const top10share =
              s.sum > 0 ? sum(sorted.slice(0, top10pct)) / s.sum : 0;
            return (
              <Tr key={label}>
                <Td className="font-semibold">{label}</Td>
                <Td right>{fmtNum(s.count)}</Td>
                <Td right strong>
                  {fmtUSD(s.sum)}
                </Td>
                <Td right>{fmtUSD(s.mean)}</Td>
                <Td right>{fmtUSD(s.median)}</Td>
                <Td right>{fmtUSD(s.stddev)}</Td>
                <Td right>{fmt2(s.cv)}</Td>
                <Td right>{fmtUSD(s.min)}</Td>
                <Td right>{fmtUSD(s.p25)}</Td>
                <Td right>{fmtUSD(s.p75)}</Td>
                <Td right>{fmtUSD(s.p95)}</Td>
                <Td right>{fmtUSD(s.max)}</Td>
                <Td right>{fmt2(s.gini)}</Td>
                <Td right>{fmtPct(top10share, 1)}</Td>
              </Tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-ink-muted mt-2 leading-snug">
        cv = stddev/mean (lower = more uniform spend). gini ∈ [0,1]: 0 =
        perfectly even, 1 = all on one row. top10% = share of total spend
        from the top decile of the sorted-desc list.
      </p>
    </Section>
  );
}

// ─── 3. By Platform × Funnel stage ────────────────────────────────

function PlatformFunnel({ rows }: { rows: UnifiedInsight[] }) {
  const stages: (FunnelStage | "ALL")[] = ["TOFU", "MOFU", "BOFU", "UNKNOWN", "ALL"];
  const platforms: ("meta" | "google" | "all")[] = ["meta", "google", "all"];

  function statsFor(arr: UnifiedInsight[]) {
    const spend = sum(arr.map((r) => r.spend));
    const conv = sum(arr.map((r) => r.conversions));
    const impr = sum(arr.map((r) => r.impressions));
    const clicks = sum(arr.map((r) => r.clicks));
    return {
      spend,
      conv,
      impr,
      clicks,
      cpa: conv > 0 ? spend / conv : 0,
      ctr: impr > 0 ? clicks / impr : 0,
      cpm: impr > 0 ? (spend / impr) * 1000 : 0,
    };
  }

  return (
    <Section title="Funnel stage × platform">
      <table className="w-full text-xs">
        <thead>
          <Tr head>
            <Th>platform</Th>
            <Th>stage</Th>
            <Th right>spend</Th>
            <Th right>share</Th>
            <Th right>impr</Th>
            <Th right>clicks</Th>
            <Th right>conv</Th>
            <Th right>cpm</Th>
            <Th right>ctr</Th>
            <Th right>cpa</Th>
          </Tr>
        </thead>
        <tbody>
          {platforms.map((p) => {
            const platformRows =
              p === "all" ? rows : rows.filter((r) => r.channel === p);
            const totalSpend = sum(platformRows.map((r) => r.spend));
            return stages.map((stage) => {
              const filtered =
                stage === "ALL"
                  ? platformRows
                  : platformRows.filter((r) => r.funnel_stage === stage);
              const s = statsFor(filtered);
              const share = totalSpend > 0 ? s.spend / totalSpend : 0;
              return (
                <Tr key={`${p}-${stage}`}>
                  <Td className="uppercase tracking-wider text-[10px] font-semibold">
                    {p}
                  </Td>
                  <Td className="font-medium">{stage}</Td>
                  <Td right strong={stage === "ALL"}>
                    {fmtUSD(s.spend)}
                  </Td>
                  <Td right>{stage === "ALL" ? "—" : fmtPct(share, 1)}</Td>
                  <Td right>{fmtNum(s.impr)}</Td>
                  <Td right>{fmtNum(s.clicks)}</Td>
                  <Td right>{fmtNum(s.conv)}</Td>
                  <Td right>{fmtUSD(s.cpm)}</Td>
                  <Td right>{fmtPct(s.ctr)}</Td>
                  <Td right>{s.cpa > 0 ? fmtUSD(s.cpa) : "—"}</Td>
                </Tr>
              );
            });
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── 4. By Platform × Objective ───────────────────────────────────

function PlatformObjective({ rows }: { rows: UnifiedInsight[] }) {
  // Group by (channel, objective). Sort by spend desc within each platform.
  type Acc = {
    channel: Channel;
    objective: string;
    funnel: FunnelStage;
    spend: number;
    impr: number;
    clicks: number;
    conv: number;
    n_rows: number;
    n_campaigns: Set<string>;
  };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    const k = `${r.channel}|${r.objective || "(blank)"}`;
    const cur =
      acc.get(k) ||
      ({
        channel: r.channel,
        objective: r.objective || "(blank)",
        funnel: r.funnel_stage,
        spend: 0,
        impr: 0,
        clicks: 0,
        conv: 0,
        n_rows: 0,
        n_campaigns: new Set<string>(),
      } as Acc);
    cur.spend += r.spend;
    cur.impr += r.impressions;
    cur.clicks += r.clicks;
    cur.conv += r.conversions;
    cur.n_rows += 1;
    if (r.campaign_id) cur.n_campaigns.add(r.campaign_id);
    acc.set(k, cur);
  }
  const arr = Array.from(acc.values()).sort((a, b) => b.spend - a.spend);

  return (
    <Section title="Platform × Objective">
      <table className="w-full text-xs">
        <thead>
          <Tr head>
            <Th>platform</Th>
            <Th>objective</Th>
            <Th>stage</Th>
            <Th right>n camp</Th>
            <Th right>n rows</Th>
            <Th right>spend</Th>
            <Th right>impr</Th>
            <Th right>clicks</Th>
            <Th right>conv</Th>
            <Th right>cpm</Th>
            <Th right>ctr</Th>
            <Th right>cpa</Th>
          </Tr>
        </thead>
        <tbody>
          {arr.map((a, i) => {
            const cpm = a.impr > 0 ? (a.spend / a.impr) * 1000 : 0;
            const ctr = a.impr > 0 ? a.clicks / a.impr : 0;
            const cpa = a.conv > 0 ? a.spend / a.conv : 0;
            return (
              <Tr key={i}>
                <Td className="uppercase tracking-wider text-[10px] font-semibold">
                  {a.channel}
                </Td>
                <Td className="font-medium">{a.objective}</Td>
                <Td className="text-[10px] uppercase tracking-wider text-ink-muted">
                  {a.funnel}
                </Td>
                <Td right>{fmtNum(a.n_campaigns.size)}</Td>
                <Td right>{fmtNum(a.n_rows)}</Td>
                <Td right strong>
                  {fmtUSD(a.spend)}
                </Td>
                <Td right>{fmtNum(a.impr)}</Td>
                <Td right>{fmtNum(a.clicks)}</Td>
                <Td right>{fmtNum(a.conv)}</Td>
                <Td right>{fmtUSD(cpm)}</Td>
                <Td right>{fmtPct(ctr)}</Td>
                <Td right>{cpa > 0 ? fmtUSD(cpa) : "—"}</Td>
              </Tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── 5/6/7. Generic group stats table ─────────────────────────────

function GroupStatsTable<T extends { spend: number; impressions: number; clicks: number; conversions: number; channel: Channel; objective: string; cpa: number }>({
  title,
  rows,
  groupFn,
  keyName,
  labelName,
}: {
  title: string;
  rows: UnifiedInsight[];
  groupFn: (rows: UnifiedInsight[]) => T[];
  keyName: keyof T;
  labelName: keyof T;
}) {
  const grouped = groupFn(rows).slice(0, 30);
  if (grouped.length === 0) return null;

  return (
    <Section title={title}>
      <table className="w-full text-xs">
        <thead>
          <Tr head>
            <Th>name</Th>
            <Th>channel</Th>
            <Th>objective</Th>
            <Th right>spend</Th>
            <Th right>impr</Th>
            <Th right>clicks</Th>
            <Th right>conv</Th>
            <Th right>cpm</Th>
            <Th right>ctr</Th>
            <Th right>cpa</Th>
          </Tr>
        </thead>
        <tbody>
          {grouped.map((g, i) => {
            const cpm = g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0;
            const ctr = g.impressions > 0 ? g.clicks / g.impressions : 0;
            return (
              <Tr key={i}>
                <Td className="max-w-[260px] truncate font-medium">
                  {String(g[labelName]) || "(unnamed)"}
                  <span className="block text-[9px] text-ink-muted">
                    {String(g[keyName])}
                  </span>
                </Td>
                <Td className="uppercase tracking-wider text-[10px]">
                  {g.channel}
                </Td>
                <Td className="text-[11px] truncate max-w-[140px]">{g.objective}</Td>
                <Td right strong>
                  {fmtUSD(g.spend)}
                </Td>
                <Td right>{fmtNum(g.impressions)}</Td>
                <Td right>{fmtNum(g.clicks)}</Td>
                <Td right>{fmtNum(g.conversions)}</Td>
                <Td right>{fmtUSD(cpm)}</Td>
                <Td right>{fmtPct(ctr)}</Td>
                <Td right>{g.cpa > 0 ? fmtUSD(g.cpa) : "—"}</Td>
              </Tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── 8. Daily series ──────────────────────────────────────────────

function DailySeries({ rows }: { rows: UnifiedInsight[] }) {
  type Daily = {
    date: string;
    meta_spend: number;
    google_spend: number;
    total_spend: number;
    impr: number;
    clicks: number;
    conv: number;
  };
  const acc = new Map<string, Daily>();
  for (const r of rows) {
    if (!r.date) continue;
    const cur =
      acc.get(r.date) ||
      ({
        date: r.date,
        meta_spend: 0,
        google_spend: 0,
        total_spend: 0,
        impr: 0,
        clicks: 0,
        conv: 0,
      } as Daily);
    if (r.channel === "meta") cur.meta_spend += r.spend;
    else cur.google_spend += r.spend;
    cur.total_spend += r.spend;
    cur.impr += r.impressions;
    cur.clicks += r.clicks;
    cur.conv += r.conversions;
    acc.set(r.date, cur);
  }
  const sorted = Array.from(acc.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return null;

  // Distribution math on the daily-spend series.
  const dailyTotals = sorted.map((d) => d.total_spend);
  const stats = summarize(dailyTotals);

  return (
    <Section title="Daily — series + distribution">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Series table */}
        <div className="md:col-span-9 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <Tr head>
                <Th>date</Th>
                <Th right>meta</Th>
                <Th right>google</Th>
                <Th right>total</Th>
                <Th right>impr</Th>
                <Th right>clicks</Th>
                <Th right>conv</Th>
                <Th right>cpa</Th>
              </Tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const cpa = d.conv > 0 ? d.total_spend / d.conv : 0;
                return (
                  <Tr key={d.date}>
                    <Td className="text-[10px] tabular-nums">{d.date}</Td>
                    <Td right>{fmtUSD(d.meta_spend)}</Td>
                    <Td right>{fmtUSD(d.google_spend)}</Td>
                    <Td right strong>
                      {fmtUSD(d.total_spend)}
                    </Td>
                    <Td right>{fmtNum(d.impr)}</Td>
                    <Td right>{fmtNum(d.clicks)}</Td>
                    <Td right>{fmtNum(d.conv)}</Td>
                    <Td right>{cpa > 0 ? fmtUSD(cpa) : "—"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Distribution side-panel */}
        <div className="md:col-span-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2">
            daily total — math
          </div>
          <table className="w-full text-xs">
            <tbody>
              <StatRow label="n days" value={fmtNum(stats.count)} />
              <StatRow label="sum" value={fmtUSD(stats.sum)} strong />
              <StatRow label="mean" value={fmtUSD(stats.mean)} />
              <StatRow label="median" value={fmtUSD(stats.median)} />
              <StatRow label="stddev" value={fmtUSD(stats.stddev)} />
              <StatRow label="cv" value={fmt2(stats.cv)} />
              <StatRow label="min" value={fmtUSD(stats.min)} />
              <StatRow label="p25" value={fmtUSD(stats.p25)} />
              <StatRow label="p75" value={fmtUSD(stats.p75)} />
              <StatRow label="p95" value={fmtUSD(stats.p95)} />
              <StatRow label="max" value={fmtUSD(stats.max)} />
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

function StatRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Tr>
      <Td className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</Td>
      <Td right strong={strong}>
        {value}
      </Td>
    </Tr>
  );
}

// ─── Tiny table primitives — no styled cards, no shadows, no rounded corners ─

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-700 border-b border-ink-100 pb-1">
        {title}
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Tr({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <tr
      className={
        head
          ? "border-b border-ink-200 text-[10px] uppercase tracking-wider text-ink-muted font-semibold"
          : "border-b border-ink-100/70"
      }
    >
      {children}
    </tr>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={`py-1.5 px-2 font-semibold ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  strong,
  className = "",
}: {
  children: React.ReactNode;
  right?: boolean;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`py-1 px-2 ${right ? "text-right" : "text-left"} ${
        strong ? "font-semibold text-ink-900" : "text-ink-700"
      } ${className}`}
    >
      {children}
    </td>
  );
}
