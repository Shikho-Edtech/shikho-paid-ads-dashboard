// Shared shapes for the paid-ads dashboard.
// Both Meta and Google insights normalize into UnifiedInsight rows so
// downstream aggregations don't branch by channel.

export type Channel = "meta" | "google";

export type FunnelStage = "TOFU" | "MOFU" | "BOFU" | "UNKNOWN";

// One row of insight data, normalized across channels.
// Spend is BDT (both pipelines write BDT-converted values into Sheets).
export interface UnifiedInsight {
  channel: Channel;
  date: string;             // ISO YYYY-MM-DD (BDT day)
  campaign_id: string;
  campaign_name: string;
  objective: string;        // raw objective from the platform (Meta) or
                            // advertising_channel_type (Google)
  funnel_stage: FunnelStage;
  spend: number;            // BDT
  impressions: number;
  clicks: number;
  conversions: number;      // best-effort: Meta = sum of conversion-like actions,
                            // Google = conversions field
  conversion_value: number; // BDT
}

export interface KpiSummary {
  total_spend: number;
  meta_spend: number;
  google_spend: number;
  total_conversions: number;
  total_conversion_value: number;
  cpa: number;              // total_spend / total_conversions (or 0)
  roas: number;             // total_conversion_value / total_spend (or 0)
}

export interface DailySpend {
  date: string;
  meta: number;
  google: number;
  total: number;
}

export interface ObjectiveRow {
  objective: string;
  funnel_stage: FunnelStage;
  channel: Channel;
  spend: number;
  conversions: number;
  cpa: number;
}

export interface FunnelRow {
  stage: FunnelStage;
  spend: number;
  share: number;            // 0-1
}

export interface RunStatus {
  meta_last_run_at: string | null;
  meta_status: string | null;
  google_last_run_at: string | null;
  google_status: string | null;
}
