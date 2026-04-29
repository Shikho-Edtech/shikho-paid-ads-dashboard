// Debug endpoint: returns what the dashboard actually sees from each
// configured sheet. Helps diagnose "Meta panel is empty" type issues
// where the symptom is silent — sheet IDs swapped, SA not shared,
// column header drift, etc.
//
// Auth: gated by the same middleware as the rest of the app.
// Hit via: /api/debug
//
// Returns JSON with per-sheet:
//   - configured spreadsheet ID (last 6 chars only — don't leak full)
//   - row count returned by Raw_Insights read
//   - first 3 column headers from Raw_Insights
//   - first row's mapped insight (so we see what the parser produces)
//   - last 3 lines of Analysis_Log
//   - any error from the read

import { NextResponse } from "next/server";
import { google } from "googleapis";
import {
  getMetaInsights,
  getGoogleInsights,
  getRunStatus,
} from "@/lib/sheets";

function tail(s: string | null | undefined): string {
  if (!s) return "(unset)";
  return s.length > 6 ? `…${s.slice(-6)}` : s;
}

async function probeSheet(spreadsheetId: string, tab: string) {
  if (!spreadsheetId) return { configured: false };
  try {
    const raw = process.env.GOOGLE_SHEETS_CREDS_JSON || "{}";
    const creds = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A:ZZ`,
    });
    const rows = res.data.values || [];
    const headers = rows[0] || [];
    return {
      configured: true,
      title: meta.data.properties?.title || "(no title)",
      tabs: (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean),
      rowCount: Math.max(rows.length - 1, 0),
      headerCount: headers.length,
      first10Headers: headers.slice(0, 10),
      // Show the value in column 14 (typical "date" position) for the
      // first 3 data rows — helps spot date format issues.
      firstDates: rows.slice(1, 4).map((r) => ({
        col_date_or_date_bdt: r[13] || r[12] || "(empty)",
        spend_or_cost: r[15] || "(empty)",
      })),
    };
  } catch (e: any) {
    return {
      configured: true,
      error: `${e?.code || "?"}: ${e?.message || String(e)}`,
    };
  }
}

export async function GET() {
  // Accept either canonical name or the ADS-suffixed variant for back-compat.
  const metaSheetId =
    process.env.META_SPREADSHEET_ID ||
    process.env.META_ADS_SPREADSHEET_ID ||
    process.env.ADS_SPREADSHEET_ID ||
    "";
  const googleSheetId =
    process.env.GOOGLE_ADS_SPREADSHEET_ID ||
    process.env.GOOGLE_SPREADSHEET_ID ||
    "";

  const [metaProbe, googleProbe, metaInsights, googleInsights, runStatus] =
    await Promise.all([
      probeSheet(metaSheetId, "Raw_Insights"),
      probeSheet(googleSheetId, "Raw_Insights"),
      getMetaInsights().catch((e) => ({ error: String(e) })),
      getGoogleInsights().catch((e) => ({ error: String(e) })),
      getRunStatus().catch((e) => ({ error: String(e) })),
    ]);

  const metaCount = Array.isArray(metaInsights) ? metaInsights.length : 0;
  const googleCount = Array.isArray(googleInsights) ? googleInsights.length : 0;

  return NextResponse.json(
    {
      env: {
        meta_sheet_id_tail: tail(metaSheetId),
        google_sheet_id_tail: tail(googleSheetId),
        sheets_creds_set: !!process.env.GOOGLE_SHEETS_CREDS_JSON,
        sa_email_in_creds: tryParseSA(process.env.GOOGLE_SHEETS_CREDS_JSON),
      },
      meta: {
        sheet_probe: metaProbe,
        mapped_insights_count: metaCount,
        first_mapped: Array.isArray(metaInsights) && metaInsights.length > 0
          ? metaInsights[0]
          : null,
        last_mapped: Array.isArray(metaInsights) && metaInsights.length > 0
          ? metaInsights[metaInsights.length - 1]
          : null,
        date_min: Array.isArray(metaInsights) && metaInsights.length > 0
          ? metaInsights.reduce((m, r) => (r.date && r.date < m ? r.date : m), "9999")
          : null,
        date_max: Array.isArray(metaInsights) && metaInsights.length > 0
          ? metaInsights.reduce((m, r) => (r.date && r.date > m ? r.date : m), "")
          : null,
        spend_total: Array.isArray(metaInsights)
          ? metaInsights.reduce((s, r) => s + (r.spend || 0), 0)
          : 0,
      },
      google: {
        sheet_probe: googleProbe,
        mapped_insights_count: googleCount,
        first_mapped: Array.isArray(googleInsights) && googleInsights.length > 0
          ? googleInsights[0]
          : null,
        last_mapped: Array.isArray(googleInsights) && googleInsights.length > 0
          ? googleInsights[googleInsights.length - 1]
          : null,
        date_min: Array.isArray(googleInsights) && googleInsights.length > 0
          ? googleInsights.reduce((m, r) => (r.date && r.date < m ? r.date : m), "9999")
          : null,
        date_max: Array.isArray(googleInsights) && googleInsights.length > 0
          ? googleInsights.reduce((m, r) => (r.date && r.date > m ? r.date : m), "")
          : null,
        spend_total: Array.isArray(googleInsights)
          ? googleInsights.reduce((s, r) => s + (r.spend || 0), 0)
          : 0,
      },
      run_status: runStatus,
    },
    { status: 200 },
  );
}

function tryParseSA(raw: string | undefined): string {
  if (!raw) return "(unset)";
  try {
    const j = JSON.parse(raw);
    return j?.client_email || "(no client_email field)";
  } catch {
    return "(parse failed)";
  }
}
