// Rule-based objective → funnel stage mapping. v1 placeholder until
// Phase 2 of ROADMAP.md ships the real Python classifier; until then
// this lives inline in the dashboard so we can ship the unified view.
//
// Rationale: dashboard charts need a stage column today. A simple
// objective-name regex is good enough for 90% of campaigns and avoids
// blocking the UI on the classifier work.

import type { FunnelStage } from "./types";

// Meta objectives (full surface: classic + Outcome-Driven Ad Experiences).
// Source: Meta Marketing API objective enum + ODAE outcome enum.
const META_TOFU = new Set([
  "BRAND_AWARENESS", "REACH", "IMPRESSIONS", "VIDEO_VIEWS",
  "OUTCOME_AWARENESS",
]);
const META_MOFU = new Set([
  "TRAFFIC", "ENGAGEMENT", "PAGE_LIKES", "POST_ENGAGEMENT",
  "EVENT_RESPONSES", "MESSAGES",
  "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT",
]);
const META_BOFU = new Set([
  "LEAD_GENERATION", "CONVERSIONS", "APP_INSTALLS",
  "OFFER_CLAIMS", "PRODUCT_CATALOG_SALES", "STORE_VISITS",
  "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION",
]);

// Google "objective" is the advertising_channel_type — broader than Meta's
// objective enum. v1 mapping uses common-case heuristics; revisit once the
// real classifier ships and we can use bidding_strategy_type + campaign
// name patterns.
const GOOGLE_TOFU = new Set([
  "DISPLAY", "VIDEO", "DEMAND_GEN", "DISCOVERY", "PERFORMANCE_MAX_AWARENESS",
]);
const GOOGLE_MOFU = new Set([
  "SEARCH", // generic non-brand search defaults here
]);
const GOOGLE_BOFU = new Set([
  "PERFORMANCE_MAX", "SHOPPING", "MULTI_CHANNEL", "LOCAL", "APP",
  "SMART", "HOTEL",
]);

export function objectiveToFunnel(
  objective: string | undefined | null,
  channel: "meta" | "google",
): FunnelStage {
  if (!objective) return "UNKNOWN";
  const normalized = String(objective).trim().toUpperCase();

  if (channel === "meta") {
    if (META_TOFU.has(normalized)) return "TOFU";
    if (META_MOFU.has(normalized)) return "MOFU";
    if (META_BOFU.has(normalized)) return "BOFU";
    return "UNKNOWN";
  }

  if (GOOGLE_TOFU.has(normalized)) return "TOFU";
  if (GOOGLE_MOFU.has(normalized)) return "MOFU";
  if (GOOGLE_BOFU.has(normalized)) return "BOFU";
  return "UNKNOWN";
}

// Stage labels + colors for charts (consumed by lib/colors.ts).
export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  TOFU: "Top of Funnel",
  MOFU: "Middle of Funnel",
  BOFU: "Bottom of Funnel",
  UNKNOWN: "Unclassified",
};
