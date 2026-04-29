// Top objectives by spend across both channels. Shows funnel stage as a
// pill (color-coded), channel as a pill, spend, conversions, CPA.

import type { ObjectiveRow } from "@/lib/types";
import { CHANNEL_COLOR, CHANNEL_LABEL, FUNNEL_COLOR } from "@/lib/colors";
import { fmtUSD, fmtNum } from "@/lib/aggregate";
import { objectiveLabel } from "@/lib/objectives";

interface Props {
  rows: ObjectiveRow[];
  limit?: number;
}

export default function ObjectiveTable({ rows, limit = 12 }: Props) {
  const top = rows.slice(0, limit);
  if (top.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        No objective spend in this window.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-ink-muted border-b border-ink-100">
            <th className="py-2 pr-3 font-semibold">Objective</th>
            <th className="py-2 px-3 font-semibold">Channel</th>
            <th className="py-2 px-3 font-semibold">Stage</th>
            <th className="py-2 px-3 font-semibold text-right">Spend</th>
            <th className="py-2 px-3 font-semibold text-right">Conv.</th>
            <th className="py-2 pl-3 font-semibold text-right">CPA</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r, i) => (
            <tr key={`${r.channel}-${r.objective}-${i}`} className="border-b border-ink-100/60">
              <td className="py-2 pr-3 font-medium text-ink-900">
                <div className="flex flex-col">
                  <span>{objectiveLabel(r.objective, r.channel)}</span>
                  <span className="text-[10px] text-ink-muted font-normal tabular-nums">
                    {r.objective}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: CHANNEL_COLOR[r.channel] }}
                >
                  {CHANNEL_LABEL[r.channel]}
                </span>
              </td>
              <td className="py-2 px-3">
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: `${FUNNEL_COLOR[r.funnel_stage]}1A`,
                    color: FUNNEL_COLOR[r.funnel_stage],
                  }}
                >
                  {r.funnel_stage}
                </span>
              </td>
              <td className="py-2 px-3 text-right tabular-nums font-semibold">
                {fmtUSD(r.spend)}
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                {fmtNum(r.conversions)}
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-ink-secondary">
                {r.cpa > 0 ? fmtUSD(r.cpa) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
