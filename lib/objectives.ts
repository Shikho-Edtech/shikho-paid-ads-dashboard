// Human-friendly labels for raw platform objective enums.
//
// Both platforms return objective values as `UPPER_SNAKE_CASE` enum
// strings (`OUTCOME_ENGAGEMENT`, `MULTI_CHANNEL`, etc). Showing those
// raw in the UI is unfriendly. This module maps to display labels.
//
// Source-of-truth references:
//   - Meta: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/#fields  (objective enum)
//   - Google: advertising_channel_type enum (SEARCH, DISPLAY, etc.)
//
// Unknown enums fall back to title-cased lowercase, so a brand-new
// platform-side enum still renders readable while we update this map.

import type { Channel } from "./types";

// Meta — both classic objectives and ODAE (Outcome-Driven Ad
// Experiences) outcomes. ODAE is the post-2022 set with `OUTCOME_*` prefix.
const META_OBJECTIVE_LABELS: Record<string, string> = {
  // Classic objectives
  BRAND_AWARENESS: "Brand Awareness",
  REACH: "Reach",
  IMPRESSIONS: "Impressions",
  VIDEO_VIEWS: "Video Views",
  TRAFFIC: "Traffic",
  LINK_CLICKS: "Link Clicks",
  ENGAGEMENT: "Engagement",
  PAGE_LIKES: "Page Likes",
  POST_ENGAGEMENT: "Post Engagement",
  EVENT_RESPONSES: "Event Responses",
  MESSAGES: "Messages",
  LEAD_GENERATION: "Lead Generation",
  CONVERSIONS: "Conversions",
  APP_INSTALLS: "App Installs",
  OFFER_CLAIMS: "Offer Claims",
  PRODUCT_CATALOG_SALES: "Catalog Sales",
  STORE_VISITS: "Store Visits",
  VIDEO: "Video Views",
  // ODAE (post-2022 outcome-driven set)
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales",
  OUTCOME_APP_PROMOTION: "App Promotion",
};

// Google — `advertising_channel_type` enum values from the API.
// MULTI_CHANNEL is what Google returns for Performance Max campaigns
// (an internal name from before PMax got its own enum value).
const GOOGLE_CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Search",
  DISPLAY: "Display",
  SHOPPING: "Shopping",
  VIDEO: "YouTube Video",
  DEMAND_GEN: "Demand Gen",
  DISCOVERY: "Discovery",
  PERFORMANCE_MAX: "Performance Max",
  MULTI_CHANNEL: "Performance Max", // legacy enum for PMax
  APP: "App",
  HOTEL: "Hotel",
  LOCAL: "Local Services",
  SMART: "Smart",
};

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function objectiveLabel(objective: string, channel: Channel): string {
  if (!objective) return "(none)";
  const map = channel === "meta" ? META_OBJECTIVE_LABELS : GOOGLE_CHANNEL_LABELS;
  return map[objective] ?? titleCase(objective);
}

// Channel-agnostic lookup — useful for dropdowns where the same raw
// enum may appear from either platform. Tries Meta map first, then
// Google, then a title-cased fallback.
export function objectiveLabelAny(objective: string): string {
  if (!objective) return "(none)";
  return (
    META_OBJECTIVE_LABELS[objective] ??
    GOOGLE_CHANNEL_LABELS[objective] ??
    titleCase(objective)
  );
}
