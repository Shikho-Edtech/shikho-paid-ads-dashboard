// Shared shapes for the paid-ads dashboard.
// Both Meta and Google insights normalize into UnifiedInsight rows so
// downstream aggregations don't branch by channel.

export type Channel = "meta" | "google";

export type FunnelStage = "TOFU" | "MOFU" | "BOFU" | "UNKNOWN";

// One row of insight data, normalized across channels.
// Spend is USD (account-currency, native to both Meta and Google for
// Shikho's accounts — no conversion at the pipeline layer).
export interface UnifiedInsight {
  channel: Channel;
  date: string;              // ISO YYYY-MM-DD
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;       // adset_id for Meta, ad_group_id for Google
  ad_group_name: string;
  ad_id: string;
  ad_name: string;
  objective: string;         // Meta: campaign objective; Google: channel_type
  funnel_stage: FunnelStage;
  spend: number;             // USD
  impressions: number;
  clicks: number;
  conversions: number;       // Meta: sum of conversion-like actions;
                             // Google: conversions field
  conversion_value: number;  // USD
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

// Hierarchy aggregations — campaign → ad group → ad
export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  channel: Channel;
  objective: string;
  funnel_stage: FunnelStage;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  ctr: number;
}

export interface AdGroupRow {
  ad_group_id: string;
  ad_group_name: string;
  campaign_id: string;
  campaign_name: string;
  channel: Channel;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
}

export interface AdRow {
  ad_id: string;
  ad_name: string;
  ad_group_id: string;
  ad_group_name: string;
  campaign_id: string;
  campaign_name: string;
  channel: Channel;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
}

export interface FunnelRow {
  stage: FunnelStage;
  spend: number;
  share: number;            // 0-1
}

// ─── Spend-overview enrichments (entity tabs joined client-side) ──
// optimization and ad_signal are platform-specific concepts:
//   Meta optimization     = adset.optimization_goal (QUALITY_CALL, OFFSITE_CONVERSIONS, …)
//   Google optimization   = ad_group.type / bidding strategy at ad-group level
//   Meta ad_signal        = first conversion_specs[].action.type on the ad
//                           (click_to_call_60s_call_end, app_custom_event, …)
//   Google ad_signal      = ad_group_ad.ad.type (RESPONSIVE_SEARCH_AD, IMAGE_AD, …)
// "(unknown)" means the lookup didn't find a value (entity deleted but
// historical insight rows still reference the id).
export interface EnrichedInsight extends UnifiedInsight {
  campaign_bid_strategy: string;
  optimization: string;
  ad_signal: string;
}

// Per-bucket rollup row for the spend-overview charts.
// `key` = dimension value, `channel` = platform owning that bucket.
// We never merge buckets across platforms — even if both have a key
// called "TRAFFIC", they stay separate so the UI doesn't fake parity.
export interface SpendBucket {
  key: string;
  channel: Channel;
  spend: number;
  ads: number;        // distinct ad_ids in this bucket
  share: number;      // 0-1 of total period spend across both platforms
  delta?: number;     // optional Δ vs comparison period (signed USD)
}

export interface RunStatus {
  meta_last_run_at: string | null;
  meta_status: string | null;
  google_last_run_at: string | null;
  google_status: string | null;
}

// ─── Conversion-action breakdown (Google Ads) ──────────────────────

export interface ConversionAction {
  conversion_action_id: string;
  resource_name: string;
  name: string;
  category: string;        // PURCHASE / LEAD / SIGNUP / PAGE_VIEW / DOWNLOAD / etc.
  type: string;            // UPLOAD_CLICKS / GOOGLE_ANALYTICS_4_* / FIREBASE_* / WEBPAGE
  status: string;          // ENABLED / REMOVED / PAUSED / HIDDEN
  primary_for_goal: boolean;
  attribution_model: string;
  customer_id: string;
  app_id: string;
}

export interface ConversionInsightRow {
  channel: Channel;        // always "google" for now (Meta has actions[] JSON instead)
  date: string;
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string;
  ad_id: string;
  ad_name: string;
  conversion_action_resource_name: string;  // join key to ConversionAction
  conversion_action_category: string;       // mirror of category for cheap filters
  conversions: number;
  conversions_value: number;
  all_conversions: number;
  all_conversions_value: number;
  view_through_conversions: number;
  cross_device_conversions: number;
  value_per_conversion: number;
}

// Aggregated per-action row for dashboards
export interface ConversionActionStats {
  conversion_action_id: string;
  resource_name: string;
  name: string;
  category: string;
  primary_for_goal: boolean;
  customer_id: string;
  conversions: number;
  conversions_value: number;
  all_conversions: number;
  spend_attributed: number;   // spend on ads where this action fired (rough — same ad might fire multiple actions)
  cpa: number;                // attributed spend / conversions
}
