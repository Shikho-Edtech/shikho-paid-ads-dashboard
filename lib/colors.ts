// Canonical color tokens for charts and pills.
// Brand v1.0 — pulls from the four Shikho core hues + channel accents.
// Avoid raw hex inside components; consume these constants instead.

import type { Channel, FunnelStage } from "./types";

export const CHANNEL_COLOR: Record<Channel, string> = {
  meta: "#1877F2",
  google: "#4285F4",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  meta: "Meta",
  google: "Google",
};

// Funnel stage colors — sunrise (TOFU, broad/light) → indigo (MOFU,
// considered) → magenta (BOFU, conversion-weight). UNKNOWN gets ink.300.
export const FUNNEL_COLOR: Record<FunnelStage, string> = {
  TOFU: "#E0A010",   // sunrise-500
  MOFU: "#304090",   // indigo-600
  BOFU: "#C02080",   // magenta-500
  UNKNOWN: "#B6BBC8", // ink-300
};

// Generic categorical fallback for arbitrary objectives.
const FALLBACK_PALETTE = [
  "#304090", "#C02080", "#E0A010", "#E03050",
  "#3F4FA2", "#A11A6D", "#B7820A", "#B72540",
];

export function colorForObjective(objective: string): string {
  let hash = 0;
  for (let i = 0; i < objective.length; i++) {
    hash = (hash * 31 + objective.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
