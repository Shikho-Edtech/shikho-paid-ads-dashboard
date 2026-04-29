"use client";

// HierarchyExplorer — the v0.2 "verify everything works end-to-end" view.
//
// What it shows: spend × clicks × conversions aggregated at three levels —
// Campaign, Ad Group / AdSet, Ad — for the date range and platform the
// user selects. Three tabs (All / Meta / Google) and three sub-tabs
// (Campaigns / Ad Groups / Ads). Optional objective filter.
//
// All filtering is client-side. The page passes the full UnifiedInsight[]
// already-filtered-by-date-range, and this component filters further by
// platform + objective, then runs the aggregations.

import { useMemo, useState } from "react";
import type { UnifiedInsight, Channel } from "@/lib/types";
import {
  byCampaign,
  byAdGroup,
  byAd,
  filterByChannel,
  filterByObjective,
  distinctObjectives,
  fmtUSD,
  fmtNum,
} from "@/lib/aggregate";
import { CHANNEL_COLOR, CHANNEL_LABEL, FUNNEL_COLOR } from "@/lib/colors";

type ChannelFilter = "all" | Channel;
type Level = "campaigns" | "adgroups" | "ads";

interface Props {
  rows: UnifiedInsight[]; // already filtered by date
  defaultChannel?: ChannelFilter;
  defaultLevel?: Level;
}

export default function HierarchyExplorer({
  rows,
  defaultChannel = "all",
  defaultLevel = "campaigns",
}: Props) {
  const [channel, setChannel] = useState<ChannelFilter>(defaultChannel);
  const [objective, setObjective] = useState<string>("all");
  const [level, setLevel] = useState<Level>(defaultLevel);
  const [limit, setLimit] = useState<number>(20);

  const filtered = useMemo(() => {
    let out = filterByChannel(rows, channel);
    out = filterByObjective(out, objective);
    return out;
  }, [rows, channel, objective]);

  const objectives = useMemo(() => distinctObjectives(filtered.length ? filtered : rows), [filtered, rows]);

  return (
    <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-4 sm:p-5">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-ink-900">
            Spend explorer
          </h2>
          <span className="text-xs text-ink-muted">
            {fmtNum(rows.length)} insight rows in window
          </span>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Platform tabs */}
          <div className="inline-flex p-0.5 bg-ink-50 rounded-lg border border-ink-100 self-start">
            {(["all", "meta", "google"] as const).map((c) => {
              const active = channel === c;
              const color = c === "all" ? "#252F73" : CHANNEL_COLOR[c];
              return (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors duration-140 ${
                    active
                      ? "text-white shadow-ambient"
                      : "text-ink-muted hover:text-ink-700"
                  }`}
                  style={active ? { background: color } : undefined}
                >
                  {c === "all" ? "All" : CHANNEL_LABEL[c]}
                </button>
              );
            })}
          </div>

          {/* Objective filter */}
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg bg-ink-50 border border-ink-100 text-ink-700 self-start"
            aria-label="Filter by objective"
          >
            <option value="all">All objectives</option>
            {objectives.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          {/* Level sub-tabs */}
          <div className="inline-flex p-0.5 bg-ink-50 rounded-lg border border-ink-100 self-start sm:ml-auto">
            {(["campaigns", "adgroups", "ads"] as const).map((l) => {
              const active = level === l;
              const label =
                l === "campaigns" ? "Campaigns" : l === "adgroups" ? "Ad Groups / AdSets" : "Ads";
              return (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors duration-140 ${
                    active
                      ? "bg-shikho-indigo-700 text-white shadow-ambient"
                      : "text-ink-muted hover:text-ink-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hierarchy table */}
      <HierarchyTable rows={filtered} level={level} limit={limit} />

      {/* Show-more */}
      <div className="mt-3 text-xs text-ink-muted text-center">
        showing top {limit}{" "}
        {limit < 100 && (
          <button
            className="ml-2 text-shikho-indigo-600 hover:text-shikho-indigo-700 font-semibold"
            onClick={() => setLimit((n) => Math.min(n + 20, 100))}
          >
            show more
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inner table per level ─────────────────────────────────────────

function HierarchyTable({
  rows,
  level,
  limit,
}: {
  rows: UnifiedInsight[];
  level: Level;
  limit: number;
}) {
  const data = useMemo(() => {
    if (level === "campaigns") return byCampaign(rows).slice(0, limit);
    if (level === "adgroups") return byAdGroup(rows).slice(0, limit);
    return byAd(rows).slice(0, limit);
  }, [rows, level, limit]);

  if (data.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        No data for the current filter set.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: level === "ads" ? 720 : 640 }}>
        <thead>
          <tr className="text-left text-ink-muted border-b border-ink-100">
            <th className="py-2 pr-3 font-semibold sticky left-0 bg-ink-paper">
              {level === "campaigns" ? "Campaign" : level === "adgroups" ? "Ad Group / AdSet" : "Ad"}
            </th>
            {level !== "campaigns" && (
              <th className="py-2 px-3 font-semibold text-ink-secondary">Campaign</th>
            )}
            <th className="py-2 px-3 font-semibold">Channel</th>
            <th className="py-2 px-3 font-semibold">Objective</th>
            <th className="py-2 px-3 font-semibold text-right">Spend</th>
            <th className="py-2 px-3 font-semibold text-right">Impr.</th>
            <th className="py-2 px-3 font-semibold text-right">Clicks</th>
            <th className="py-2 px-3 font-semibold text-right">Conv.</th>
            <th className="py-2 pl-3 font-semibold text-right">CPA</th>
          </tr>
        </thead>
        <tbody>
          {(data as any[]).map((row, i: number) => {
            const channelKey = row.channel as Channel;
            const funnelKey = (level === "campaigns" ? row.funnel_stage : null) as
              | keyof typeof FUNNEL_COLOR
              | null;
            const name: string =
              level === "ads"
                ? row.ad_name
                : level === "adgroups"
                ? row.ad_group_name
                : row.campaign_name;
            const id: string =
              level === "ads"
                ? row.ad_id
                : level === "adgroups"
                ? row.ad_group_id
                : row.campaign_id;
            const parentCampaign: string = level === "campaigns" ? "" : row.campaign_name;

            return (
              <tr key={`${row.channel}-${id}-${i}`} className="border-b border-ink-100/60">
                <td className="py-2 pr-3 sticky left-0 bg-ink-paper">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-ink-900 truncate max-w-[220px] sm:max-w-[320px]">
                      {name}
                    </span>
                    <span className="text-[10px] text-ink-muted tabular-nums">{id}</span>
                  </div>
                </td>
                {level !== "campaigns" && (
                  <td className="py-2 px-3 text-ink-secondary text-xs truncate max-w-[200px]">
                    {parentCampaign}
                  </td>
                )}
                <td className="py-2 px-3">
                  <span
                    className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                    style={{ background: CHANNEL_COLOR[channelKey] }}
                  >
                    {CHANNEL_LABEL[channelKey]}
                  </span>
                </td>
                <td className="py-2 px-3 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink-700 truncate max-w-[160px]">
                      {row.objective || "—"}
                    </span>
                    {funnelKey && (
                      <span
                        className="inline-flex w-fit text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: `${FUNNEL_COLOR[funnelKey]}1A`,
                          color: FUNNEL_COLOR[funnelKey],
                        }}
                      >
                        {funnelKey}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {fmtUSD(row.spend)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-ink-secondary">
                  {fmtNum(row.impressions)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-ink-secondary">
                  {fmtNum(row.clicks)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {fmtNum(row.conversions)}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-ink-secondary">
                  {row.cpa > 0 ? fmtUSD(row.cpa) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
