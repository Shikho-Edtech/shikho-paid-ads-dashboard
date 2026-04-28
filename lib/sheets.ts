// Google Sheets reader for the paid-ads dashboard.
//
// Reads from TWO separate spreadsheets — one written by the Meta pipeline,
// one by the Google Ads pipeline — and unifies their Raw_Insights rows.
//
// Auth: shared `paid-ads-analytics-pipeline` service account. The dashboard
// only needs read scope; both sheets are explicitly shared with the SA.
//
// Fail-soft: if either sheet fetch fails (env var missing, sheet not shared,
// API error), we return [] for that channel and let the page render an
// empty-state. The dashboard never crashes because one channel is missing.

import { google } from "googleapis";
import type {
  Channel,
  UnifiedInsight,
  RunStatus,
} from "./types";
import { objectiveToFunnel } from "./funnel";

let cachedClient: any = null;

function getSheetsClient() {
  if (cachedClient) return cachedClient;
  const raw = process.env.GOOGLE_SHEETS_CREDS_JSON || "{}";
  let creds: any;
  try {
    creds = JSON.parse(raw);
  } catch {
    creds = {};
  }
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

async function readTab(spreadsheetId: string, tab: string): Promise<any[][]> {
  if (!spreadsheetId) return [];
  const sheets = getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A:ZZ`,
    });
    return res.data.values || [];
  } catch (e) {
    // Loud server log so the failure surfaces in Vercel; UI stays empty.
    console.error(
      `[sheets] read fail spreadsheet=${spreadsheetId.slice(0, 8)}… tab=${tab}:`,
      (e as any)?.message || e,
    );
    return [];
  }
}

function rowsToObjects(rows: any[][]): Record<string, any>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ─── Meta-side mappers ─────────────────────────────────────────────

// Meta `actions` is a JSON-serialized array of {action_type, value} objects.
// We coalesce conversion-like action types into a single conversions count
// for the unified shape. Same for action_values → conversion_value (BDT).
const META_CONVERSION_ACTIONS = new Set([
  "lead", "purchase", "complete_registration",
  "submit_application", "schedule",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.fb_pixel_purchase",
  "offsite_conversion.fb_pixel_complete_registration",
  "onsite_conversion.lead_grouped",
  "onsite_conversion.messaging_conversation_started_7d",
]);

function parseActionsJson(raw: any): Array<{ action_type: string; value: number }> {
  if (!raw) return [];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a: any) => ({
      action_type: String(a.action_type ?? ""),
      value: Number(a.value ?? 0) || 0,
    }));
  } catch {
    return [];
  }
}

function metaRowToInsight(r: Record<string, any>): UnifiedInsight {
  const objective = String(r["objective"] || r["Objective"] || "").trim();
  const date =
    String(r["date_start"] || r["Date Start"] || r["date"] || "").slice(0, 10) || "";

  const actions = parseActionsJson(r["actions"] ?? r["Actions"]);
  const action_values = parseActionsJson(r["action_values"] ?? r["Action Values"]);
  const conversions = actions
    .filter((a) => META_CONVERSION_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + a.value, 0);
  const conversion_value = action_values
    .filter((a) => META_CONVERSION_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + a.value, 0);

  return {
    channel: "meta",
    date,
    campaign_id: String(r["campaign_id"] || r["Campaign ID"] || ""),
    campaign_name: String(r["campaign_name"] || r["Campaign Name"] || ""),
    objective,
    funnel_stage: objectiveToFunnel(objective, "meta"),
    spend: num(r["spend"] ?? r["Spend"]),
    impressions: num(r["impressions"] ?? r["Impressions"]),
    clicks: num(r["clicks"] ?? r["Clicks"]),
    conversions,
    conversion_value,
  };
}

// ─── Google-side mappers ───────────────────────────────────────────

// Google Ads pipeline writes Raw_Insights with cost in BDT (already
// converted from micros by the pipeline). Conversion fields are flat
// columns (conversions, conversions_value) — no JSON parsing needed.
function googleRowToInsight(r: Record<string, any>): UnifiedInsight {
  const objective = String(
    r["advertising_channel_type"] ||
      r["Advertising Channel Type"] ||
      r["channel_type"] ||
      "",
  ).trim();
  const date =
    String(r["date"] || r["Date"] || r["segments_date"] || "").slice(0, 10) || "";

  return {
    channel: "google",
    date,
    campaign_id: String(r["campaign_id"] || r["Campaign ID"] || ""),
    campaign_name: String(r["campaign_name"] || r["Campaign Name"] || ""),
    objective,
    funnel_stage: objectiveToFunnel(objective, "google"),
    spend: num(r["cost"] ?? r["Cost"] ?? r["spend"] ?? r["Spend"]),
    impressions: num(r["impressions"] ?? r["Impressions"]),
    clicks: num(r["clicks"] ?? r["Clicks"]),
    conversions: num(r["conversions"] ?? r["Conversions"]),
    conversion_value: num(
      r["conversions_value"] ?? r["Conversions Value"] ?? r["conversion_value"],
    ),
  };
}

// ─── Public entrypoints ────────────────────────────────────────────

export async function getMetaInsights(): Promise<UnifiedInsight[]> {
  const id = process.env.META_SPREADSHEET_ID || "";
  // Tab name must match what the Meta pipeline writes; v2.1 = Raw_Insights
  // (totals + daily merged on the same tab).
  const rows = await readTab(id, "Raw_Insights");
  return rowsToObjects(rows).map(metaRowToInsight).filter((i) => i.date);
}

export async function getGoogleInsights(): Promise<UnifiedInsight[]> {
  const id = process.env.GOOGLE_ADS_SPREADSHEET_ID || "";
  const rows = await readTab(id, "Raw_Insights");
  return rowsToObjects(rows).map(googleRowToInsight).filter((i) => i.date);
}

export async function getAllInsights(): Promise<UnifiedInsight[]> {
  const [meta, googleRows] = await Promise.all([
    getMetaInsights(),
    getGoogleInsights(),
  ]);
  return [...meta, ...googleRows];
}

// ─── Run status (for the staleness banner) ─────────────────────────
//
// Both pipelines write a row to Analysis_Log on every run. We pull the
// latest from each so the dashboard can show "Meta last refreshed Xh ago".

export async function getRunStatus(): Promise<RunStatus> {
  const [metaRows, googleRows] = await Promise.all([
    readTab(process.env.META_SPREADSHEET_ID || "", "Analysis_Log"),
    readTab(process.env.GOOGLE_ADS_SPREADSHEET_ID || "", "Analysis_Log"),
  ]);

  function latest(rows: any[][]): { at: string | null; status: string | null } {
    const objs = rowsToObjects(rows);
    if (objs.length === 0) return { at: null, status: null };
    // Most recent row wins. Pipelines append, so the last row is newest.
    const last = objs[objs.length - 1];
    return {
      at: String(last["timestamp"] || last["Timestamp"] || last["run_at"] || "") || null,
      status: String(last["fetch_status"] || last["status"] || "") || null,
    };
  }

  const m = latest(metaRows);
  const g = latest(googleRows);
  return {
    meta_last_run_at: m.at,
    meta_status: m.status,
    google_last_run_at: g.at,
    google_status: g.status,
  };
}

export function channelHasData(
  insights: UnifiedInsight[],
  channel: Channel,
): boolean {
  return insights.some((i) => i.channel === channel);
}
