// Aggregations consumed by the dashboard pages. Each helper takes the
// already-unified UnifiedInsight[] and slices it into a render-ready shape.

import type {
  UnifiedInsight,
  KpiSummary,
  DailySpend,
  ObjectiveRow,
  FunnelRow,
  FunnelStage,
} from "./types";

export function filterByDateRange(
  rows: UnifiedInsight[],
  start: string, // ISO YYYY-MM-DD inclusive
  end: string,   // inclusive
): UnifiedInsight[] {
  return rows.filter((r) => r.date >= start && r.date <= end);
}

export function summarizeKpis(rows: UnifiedInsight[]): KpiSummary {
  let meta_spend = 0;
  let google_spend = 0;
  let total_conversions = 0;
  let total_conversion_value = 0;

  for (const r of rows) {
    if (r.channel === "meta") meta_spend += r.spend;
    else google_spend += r.spend;
    total_conversions += r.conversions;
    total_conversion_value += r.conversion_value;
  }

  const total_spend = meta_spend + google_spend;
  const cpa = total_conversions > 0 ? total_spend / total_conversions : 0;
  const roas = total_spend > 0 ? total_conversion_value / total_spend : 0;

  return {
    total_spend,
    meta_spend,
    google_spend,
    total_conversions,
    total_conversion_value,
    cpa,
    roas,
  };
}

export function dailySpend(rows: UnifiedInsight[]): DailySpend[] {
  const byDate = new Map<string, { meta: number; google: number }>();
  for (const r of rows) {
    if (!r.date) continue;
    const cur = byDate.get(r.date) || { meta: 0, google: 0 };
    if (r.channel === "meta") cur.meta += r.spend;
    else cur.google += r.spend;
    byDate.set(r.date, cur);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      meta: v.meta,
      google: v.google,
      total: v.meta + v.google,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function objectiveBreakdown(rows: UnifiedInsight[]): ObjectiveRow[] {
  const key = (r: UnifiedInsight) => `${r.channel}|${r.objective}|${r.funnel_stage}`;
  const acc = new Map<string, ObjectiveRow>();
  for (const r of rows) {
    const k = key(r);
    const cur =
      acc.get(k) || {
        objective: r.objective || "(blank)",
        funnel_stage: r.funnel_stage,
        channel: r.channel,
        spend: 0,
        conversions: 0,
        cpa: 0,
      };
    cur.spend += r.spend;
    cur.conversions += r.conversions;
    acc.set(k, cur);
  }
  return Array.from(acc.values())
    .map((row) => ({
      ...row,
      cpa: row.conversions > 0 ? row.spend / row.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export function funnelBreakdown(rows: UnifiedInsight[]): FunnelRow[] {
  const totals: Record<FunnelStage, number> = {
    TOFU: 0, MOFU: 0, BOFU: 0, UNKNOWN: 0,
  };
  let grand = 0;
  for (const r of rows) {
    totals[r.funnel_stage] += r.spend;
    grand += r.spend;
  }
  const stages: FunnelStage[] = ["TOFU", "MOFU", "BOFU", "UNKNOWN"];
  return stages.map((stage) => ({
    stage,
    spend: totals[stage],
    share: grand > 0 ? totals[stage] / grand : 0,
  }));
}

// Utility: format BDT amounts compactly (৳12.3K, ৳1.2M).
export function fmtBDT(n: number): string {
  if (!isFinite(n)) return "৳0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}৳${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}৳${(abs / 1000).toFixed(1)}K`;
  return `${sign}৳${abs.toFixed(0)}`;
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  return n.toFixed(0);
}
