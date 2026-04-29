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

// CONTRACT: Meta pipeline writes Raw_Insights with these EXACT column
// headers (see meta-ads-pipeline/src/sheets.py::RAW_INSIGHTS_HEADERS).
// Renaming any of these is a CONTRACTS.md §6.1 lockstep change.
function metaRowToInsight(r: Record<string, any>): UnifiedInsight {
  const objective = String(r["Objective"] || "").trim();
  const date = String(r["Date (BDT)"] || "").slice(0, 10);

  const actions = parseActionsJson(r["Actions (JSON)"]);
  const action_values = parseActionsJson(r["Action Values (JSON)"]);
  const conversions = actions
    .filter((a) => META_CONVERSION_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + a.value, 0);
  const conversion_value = action_values
    .filter((a) => META_CONVERSION_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + a.value, 0);

  return {
    channel: "meta",
    date,
    campaign_id: String(r["Campaign ID"] || ""),
    campaign_name: String(r["Campaign Name"] || ""),
    ad_group_id: String(r["AdSet ID"] || ""),
    ad_group_name: String(r["AdSet Name"] || ""),
    ad_id: String(r["Ad ID"] || ""),
    ad_name: String(r["Ad Name"] || ""),
    objective,
    funnel_stage: objectiveToFunnel(objective, "meta"),
    spend: num(r["Spend (USD)"]),
    impressions: num(r["Impressions"]),
    clicks: num(r["Clicks"]),
    conversions,
    conversion_value,
  };
}

// ─── Google-side mappers ───────────────────────────────────────────

// CONTRACT: Google Ads pipeline writes Raw_Insights with these EXACT
// column headers (see google-ads-pipeline/src/sheets.py::RAW_INSIGHTS_HEADERS).
// Renaming any of these is a CONTRACTS.md §6.1 lockstep change.
// Cost is USD natively — pipeline converts cost_micros via micros_to_currency().
function googleRowToInsight(r: Record<string, any>): UnifiedInsight {
  const objective = String(r["Channel Type"] || "").trim();
  const date = String(r["Date"] || "").slice(0, 10);

  return {
    channel: "google",
    date,
    campaign_id: String(r["Campaign ID"] || ""),
    campaign_name: String(r["Campaign Name"] || ""),
    ad_group_id: String(r["Ad Group ID"] || ""),
    ad_group_name: String(r["Ad Group Name"] || ""),
    ad_id: String(r["Ad ID"] || ""),
    ad_name: String(r["Ad Name"] || ""),
    objective,
    funnel_stage: objectiveToFunnel(objective, "google"),
    spend: num(r["Cost (USD)"]),
    impressions: num(r["Impressions"]),
    clicks: num(r["Clicks"]),
    conversions: num(r["Conversions"]),
    conversion_value: num(r["Conversions Value"]),
  };
}

// ─── Public entrypoints ────────────────────────────────────────────

// Resolve sheet IDs with fallback. CONTRACTS.md §7.3 names them
// META_SPREADSHEET_ID and GOOGLE_ADS_SPREADSHEET_ID, but earlier
// deployments may have set META_ADS_SPREADSHEET_ID. Accept either.
function metaSheetId(): string {
  return (
    process.env.META_SPREADSHEET_ID ||
    process.env.META_ADS_SPREADSHEET_ID ||
    process.env.ADS_SPREADSHEET_ID ||
    ""
  );
}

function googleSheetId(): string {
  return (
    process.env.GOOGLE_ADS_SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    ""
  );
}

export async function getMetaInsights(): Promise<UnifiedInsight[]> {
  const id = metaSheetId();
  // Tab name must match what the Meta pipeline writes; v2.1 = Raw_Insights
  // (totals + daily merged on the same tab).
  const rows = await readTab(id, "Raw_Insights");
  return rowsToObjects(rows).map(metaRowToInsight).filter((i) => i.date);
}

export async function getGoogleInsights(): Promise<UnifiedInsight[]> {
  const id = googleSheetId();
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
    readTab(metaSheetId(), "Analysis_Log"),
    readTab(googleSheetId(), "Analysis_Log"),
  ]);

  function latest(rows: any[][]): { at: string | null; status: string | null } {
    const objs = rowsToObjects(rows);
    if (objs.length === 0) return { at: null, status: null };
    // Most recent row wins. Pipelines append, so the last row is newest.
    // Both pipelines use "Run At (BDT)" + "Fetch Status" as the header
    // names (see meta-ads-pipeline + google-ads-pipeline src/sheets.py
    // ANALYSIS_LOG_HEADERS).
    const last = objs[objs.length - 1];
    return {
      at:
        String(
          last["Run At (BDT)"] ||
            last["Run At"] ||
            last["timestamp"] ||
            last["run_at"] ||
            "",
        ) || null,
      status:
        String(last["Fetch Status"] || last["fetch_status"] || last["status"] || "") ||
        null,
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
