// Horizontal stacked bar showing TOFU / MOFU / BOFU spend share.
// Cleaner than a donut on narrow screens and lets us show absolute spend
// per stage at the same time.

import type { FunnelRow } from "@/lib/types";
import { FUNNEL_COLOR } from "@/lib/colors";
import { FUNNEL_LABELS } from "@/lib/funnel";
import { fmtUSD, fmtPct } from "@/lib/aggregate";

interface Props {
  data: FunnelRow[];
}

export default function FunnelBar({ data }: Props) {
  const visible = data.filter((r) => r.spend > 0);
  if (visible.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-8 text-center">
        Nothing to break down yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stacked bar */}
      <div
        className="w-full h-6 rounded-md overflow-hidden flex bg-ink-100"
        role="img"
        aria-label="Spend by funnel stage"
      >
        {visible.map((row) => (
          <div
            key={row.stage}
            style={{
              width: `${(row.share * 100).toFixed(2)}%`,
              background: FUNNEL_COLOR[row.stage],
            }}
            title={`${FUNNEL_LABELS[row.stage]}: ${fmtUSD(row.spend)} (${fmtPct(row.share)})`}
          />
        ))}
      </div>

      {/* Legend rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((row) => (
          <div
            key={row.stage}
            className="flex items-center justify-between gap-3 p-2 rounded-md bg-ink-50 border border-ink-100"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ background: FUNNEL_COLOR[row.stage] }}
              />
              <span className="text-sm font-medium text-ink-700 truncate">
                {FUNNEL_LABELS[row.stage]}
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-shrink-0">
              <span className="text-sm font-semibold tabular-nums text-ink-900">
                {fmtUSD(row.spend)}
              </span>
              <span className="text-xs text-ink-muted tabular-nums">
                {fmtPct(row.share)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
