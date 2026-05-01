// Aggregations consumed by the dashboard pages. Each helper takes the
// already-unified UnifiedInsight[] and slices it into a render-ready shape.

import type {
  UnifiedInsight,
  KpiSummary,
  DailySpend,
  ObjectiveRow,
  FunnelRow,
  FunnelStage,
  CampaignRow,
  AdGroupRow,
  AdRow,
  Channel,
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

// Utility: format USD amounts compactly ($12.3K, $1.2M).
// All spend values flow as USD from both pipelines (account currency).
export function fmtUSD(n: number): string {
  if (!isFinite(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// Backward-compat alias — old call sites used `fmtBDT`. Keep until all
// imports migrate, then delete.
export const fmtBDT = fmtUSD;

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function fmtNum(n: number): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return n.toFixed(0);
}

// ─── Filters ──────────────────────────────────────────────────────

export function filterByChannel(
  rows: UnifiedInsight[],
  channel: Channel | "all",
): UnifiedInsight[] {
  if (channel === "all") return rows;
  return rows.filter((r) => r.channel === channel);
}

export function filterByObjective(
  rows: UnifiedInsight[],
  objective: string | "all",
): UnifiedInsight[] {
  if (objective === "all") return rows;
  return rows.filter((r) => r.objective === objective);
}

// ─── Hierarchy aggregations ───────────────────────────────────────

export function byCampaign(rows: UnifiedInsight[]): CampaignRow[] {
  const acc = new Map<string, CampaignRow>();
  for (const r of rows) {
    const k = `${r.channel}|${r.campaign_id}`;
    const cur =
      acc.get(k) ||
      ({
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name || "(unnamed)",
        channel: r.channel,
        objective: r.objective || "(blank)",
        funnel_stage: r.funnel_stage,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cpa: 0,
        ctr: 0,
      } as CampaignRow);
    cur.spend += r.spend;
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    acc.set(k, cur);
  }
  return Array.from(acc.values())
    .map((c) => ({
      ...c,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export function byAdGroup(rows: UnifiedInsight[]): AdGroupRow[] {
  const acc = new Map<string, AdGroupRow>();
  for (const r of rows) {
    if (!r.ad_group_id) continue;
    const k = `${r.channel}|${r.ad_group_id}`;
    const cur =
      acc.get(k) ||
      ({
        ad_group_id: r.ad_group_id,
        ad_group_name: r.ad_group_name || "(unnamed)",
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name || "(unnamed)",
        channel: r.channel,
        objective: r.objective || "(blank)",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cpa: 0,
      } as AdGroupRow);
    cur.spend += r.spend;
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    acc.set(k, cur);
  }
  return Array.from(acc.values())
    .map((c) => ({
      ...c,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export function byAd(rows: UnifiedInsight[]): AdRow[] {
  const acc = new Map<string, AdRow>();
  for (const r of rows) {
    if (!r.ad_id) continue;
    const k = `${r.channel}|${r.ad_id}`;
    const cur =
      acc.get(k) ||
      ({
        ad_id: r.ad_id,
        ad_name: r.ad_name || "(unnamed)",
        ad_group_id: r.ad_group_id,
        ad_group_name: r.ad_group_name || "(unnamed)",
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name || "(unnamed)",
        channel: r.channel,
        objective: r.objective || "(blank)",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        cpa: 0,
      } as AdRow);
    cur.spend += r.spend;
    cur.impressions += r.impressions;
    cur.clicks += r.clicks;
    cur.conversions += r.conversions;
    acc.set(k, cur);
  }
  return Array.from(acc.values())
    .map((c) => ({
      ...c,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// All distinct objectives present in the data, sorted by spend desc.
export function distinctObjectives(rows: UnifiedInsight[]): string[] {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const k = r.objective || "(blank)";
    acc.set(k, (acc.get(k) || 0) + r.spend);
  }
  return Array.from(acc.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

// Date utilities for the date range picker.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Conversion-action aggregations ────────────────────────────────

import type {
  ConversionAction,
  ConversionInsightRow,
  ConversionActionStats,
} from "./types";

export function filterConversionsByDateRange(
  rows: ConversionInsightRow[],
  start: string,
  end: string,
): ConversionInsightRow[] {
  return rows.filter((r) => r.date >= start && r.date <= end);
}

// Aggregate conversion insights into per-action stats. Joins to the
// ConversionAction lookup so each row carries the human-readable name +
// category + primary_for_goal flag. Spend cannot be cleanly attributed
// per conversion_action because one ad fires multiple actions, so we
// don't compute "cost per X conversion" — stick to volumes + values.
export function byConversionAction(
  insights: ConversionInsightRow[],
  actions: ConversionAction[],
): ConversionActionStats[] {
  // Look up actions by resource_name (the join key in segments.conversion_action).
  const byResource = new Map<string, ConversionAction>();
  for (const a of actions) {
    if (a.resource_name) byResource.set(a.resource_name, a);
  }

  const acc = new Map<string, ConversionActionStats>();
  for (const r of insights) {
    const key = r.conversion_action_resource_name;
    if (!key) continue;
    const action = byResource.get(key);
    const cur =
      acc.get(key) ||
      ({
        conversion_action_id: action?.conversion_action_id || key.split("/").pop() || "",
        resource_name: key,
        name: action?.name || "(unknown action)",
        category: action?.category || r.conversion_action_category || "UNKNOWN",
        primary_for_goal: action?.primary_for_goal ?? false,
        customer_id: action?.customer_id || r.customer_id,
        conversions: 0,
        conversions_value: 0,
        all_conversions: 0,
        spend_attributed: 0,
        cpa: 0,
      } as ConversionActionStats);
    cur.conversions += r.conversions;
    cur.conversions_value += r.conversions_value;
    cur.all_conversions += r.all_conversions;
    acc.set(key, cur);
  }
  return Array.from(acc.values()).sort((a, b) => b.conversions - a.conversions);
}

// Filter conversion insights to only those whose conversion_action is
// flagged primary_for_goal=TRUE on the platform side. This is the
// number Smart Bidding optimizes against — and the one we want shown
// as the headline "Conversions" KPI on the overview.
export function filterPrimaryConversions(
  rows: ConversionInsightRow[],
  actions: ConversionAction[],
): ConversionInsightRow[] {
  const primary = new Set<string>(
    actions.filter((a) => a.primary_for_goal).map((a) => a.resource_name),
  );
  return rows.filter((r) =>
    primary.has(r.conversion_action_resource_name),
  );
}

// Sum conversions / value across a row set. Used for the headline KPI.
export function sumConversions(rows: ConversionInsightRow[]): {
  conversions: number;
  conversions_value: number;
  all_conversions: number;
} {
  let conv = 0, val = 0, all = 0;
  for (const r of rows) {
    conv += r.conversions;
    val += r.conversions_value;
    all += r.all_conversions;
  }
  return { conversions: conv, conversions_value: val, all_conversions: all };
}

// ─────────────────────────────────────────────────────────────────────
// Spend-overview rollups
// ─────────────────────────────────────────────────────────────────────
import type { EnrichedInsight, SpendBucket } from "./types";

// Filter helper for the enriched shape — same predicate as filterByDateRange
// but typed for EnrichedInsight (TS doesn't widen UnifiedInsight[] callers).
export function filterEnrichedByDateRange(
  rows: EnrichedInsight[],
  start: string,
  end: string,
): EnrichedInsight[] {
  return rows.filter((r) => r.date >= start && r.date <= end);
}

// Group enriched rows by a chosen dimension and channel. Returns
// SpendBuckets sorted by spend desc. `getKey` returns the dimension
// value for a row (e.g., r.objective, r.optimization, r.ad_signal).
// `share` is computed against the grand total across both platforms so
// percentages always sum to 100% in the combined view.
export function bucketBy(
  rows: EnrichedInsight[],
  getKey: (r: EnrichedInsight) => string,
): SpendBucket[] {
  const acc = new Map<string, SpendBucket & { _adIds: Set<string> }>();
  let grand = 0;
  for (const r of rows) {
    const key = getKey(r) || "(blank)";
    const k = `${r.channel}|${key}`;
    let cur = acc.get(k);
    if (!cur) {
      cur = {
        key,
        channel: r.channel,
        spend: 0,
        ads: 0,
        share: 0,
        _adIds: new Set<string>(),
      };
      acc.set(k, cur);
    }
    cur.spend += r.spend;
    if (r.ad_id) cur._adIds.add(r.ad_id);
    grand += r.spend;
  }
  const out: SpendBucket[] = [];
  for (const v of acc.values()) {
    out.push({
      key: v.key,
      channel: v.channel,
      spend: v.spend,
      ads: v._adIds.size,
      share: grand > 0 ? v.spend / grand : 0,
    });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

// Pair two bucket arrays (current + comparison) and attach delta. Buckets
// not present in `compare` get delta = current.spend (treated as +full).
// Buckets present only in `compare` are appended with negative spend.
export function attachDelta(
  current: SpendBucket[],
  compare: SpendBucket[],
): SpendBucket[] {
  const compIdx = new Map<string, SpendBucket>();
  for (const b of compare) compIdx.set(`${b.channel}|${b.key}`, b);
  const seen = new Set<string>();
  const out: SpendBucket[] = current.map((b) => {
    const k = `${b.channel}|${b.key}`;
    seen.add(k);
    const prev = compIdx.get(k);
    return { ...b, delta: b.spend - (prev?.spend || 0) };
  });
  // Surface dropped-off buckets too — channels stopped spending on a key.
  for (const b of compare) {
    const k = `${b.channel}|${b.key}`;
    if (seen.has(k)) continue;
    out.push({ ...b, spend: 0, ads: 0, share: 0, delta: -b.spend });
  }
  return out.sort(
    (a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0) || b.spend - a.spend,
  );
}

// Sum total spend for an enriched slice. Cheap — used for KPI tiles.
export function totalSpend(rows: EnrichedInsight[]): number {
  let s = 0;
  for (const r of rows) s += r.spend;
  return s;
}

// Distinct campaign IDs that had spend > 0 in the slice. Honest
// "spending campaigns" count vs "active campaigns" which can include
// $0-impression campaigns.
export function spendingCampaignCount(rows: EnrichedInsight[]): number {
  const ids = new Set<string>();
  for (const r of rows) if (r.spend > 0 && r.campaign_id) ids.add(r.campaign_id);
  return ids.size;
}

// Concentration: top-N campaigns' spend share. Defaults to top 5.
// Returns NaN if rows empty.
export function spendConcentration(rows: EnrichedInsight[], topN = 5): number {
  const byCamp = new Map<string, number>();
  let grand = 0;
  for (const r of rows) {
    if (!r.campaign_id) continue;
    byCamp.set(r.campaign_id, (byCamp.get(r.campaign_id) || 0) + r.spend);
    grand += r.spend;
  }
  if (grand <= 0) return 0;
  const sorted = Array.from(byCamp.values()).sort((a, b) => b - a);
  const top = sorted.slice(0, topN).reduce((s, v) => s + v, 0);
  return top / grand;
}

// Daily spend by channel — mirrors dailySpend() above but on enriched.
export function dailySpendEnriched(rows: EnrichedInsight[]): DailySpend[] {
  return dailySpend(rows as unknown as UnifiedInsight[]);
}

// Comparison-period resolver. Given a current (start, end), returns the
// equal-length immediately-prior period: (prev_start, prev_end).
// Inclusive on both ends, ISO YYYY-MM-DD.
export function priorPeriod(start: string, end: string): { start: string; end: string } {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

// Top-N campaigns table source. Returns enriched-friendly rows so the
// drill-down table can show platform + bid strategy without re-joining.
export interface CampaignSpendRow {
  campaign_id: string;
  campaign_name: string;
  channel: Channel;
  objective: string;
  bid_strategy: string;
  ad_groups: number;
  ads: number;
  spend: number;
  share: number;
  delta?: number;
}

export function campaignSpendTable(
  rows: EnrichedInsight[],
  compareRows?: EnrichedInsight[],
): CampaignSpendRow[] {
  const build = (rs: EnrichedInsight[]): Map<string, CampaignSpendRow & { _ag: Set<string>; _ad: Set<string> }> => {
    const m = new Map<string, CampaignSpendRow & { _ag: Set<string>; _ad: Set<string> }>();
    let grand = 0;
    for (const r of rs) grand += r.spend;
    for (const r of rs) {
      const k = `${r.channel}|${r.campaign_id}`;
      let cur = m.get(k);
      if (!cur) {
        cur = {
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          channel: r.channel,
          objective: r.objective,
          bid_strategy: r.campaign_bid_strategy,
          ad_groups: 0,
          ads: 0,
          spend: 0,
          share: 0,
          _ag: new Set(),
          _ad: new Set(),
        };
        m.set(k, cur);
      }
      cur.spend += r.spend;
      if (r.ad_group_id) cur._ag.add(r.ad_group_id);
      if (r.ad_id) cur._ad.add(r.ad_id);
    }
    for (const cur of m.values()) {
      cur.ad_groups = cur._ag.size;
      cur.ads = cur._ad.size;
      cur.share = grand > 0 ? cur.spend / grand : 0;
    }
    return m;
  };

  const cur = build(rows);
  const out: CampaignSpendRow[] = Array.from(cur.values()).map(
    ({ _ag, _ad, ...rest }) => rest,
  );

  if (compareRows) {
    const prev = build(compareRows);
    for (const row of out) {
      const k = `${row.channel}|${row.campaign_id}`;
      const p = prev.get(k);
      row.delta = row.spend - (p?.spend || 0);
    }
    // Surface campaigns that spent in compare but not current.
    for (const [k, p] of prev) {
      if (cur.has(k)) continue;
      const { _ag, _ad, ...rest } = p;
      out.push({ ...rest, spend: 0, share: 0, delta: -p.spend });
    }
  }

  return out.sort((a, b) => b.spend - a.spend);
}
