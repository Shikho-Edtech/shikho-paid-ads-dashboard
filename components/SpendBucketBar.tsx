// Ranked spend list — one row per (channel × dimension value).
// Rendered inside a SectionCard wrapper from the calling page so this
// component focuses on the row layout itself.
//
// Mobile-first:
//   - 360px: label wraps, $/% column drops below the label
//   - sm+:   single-line row, label left, value/share/Δ right-aligned
// No hover-only affordances. The progress bar is informational, not
// the only signal — the $ value is always visible.

import type { SpendBucket } from "@/lib/types";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/colors";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/aggregate";

interface Props {
  buckets: SpendBucket[];
  emptyText?: string;
  showAdCount?: boolean;
  /** Cap rows at top-N to keep mobile dense lists readable. Default 12. */
  topN?: number;
}

export default function SpendBucketBar({
  buckets,
  emptyText = "No spend in the selected range.",
  showAdCount = false,
  topN = 12,
}: Props) {
  const list = buckets.slice(0, topN);
  const max = Math.max(0, ...list.map((b) => b.spend));
  const truncated = buckets.length - list.length;

  if (list.length === 0) {
    return (
      <div className="text-xs text-ink-muted py-3 px-1 leading-snug">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-ink-100">
        {list.map((b) => {
          const widthPct = max > 0 ? (b.spend / max) * 100 : 0;
          const color = CHANNEL_COLOR[b.channel];
          const deltaPill =
            b.delta !== undefined && Math.abs(b.delta) >= 0.5
              ? b.delta > 0
                ? {
                    txt: `+${fmtUSD(b.delta)}`,
                    cls: "bg-shikho-sunrise-50 text-shikho-sunrise-700",
                  }
                : {
                    txt: fmtUSD(b.delta),
                    cls: "bg-shikho-coral-50 text-shikho-coral-700",
                  }
              : null;
          return (
            <li
              key={`${b.channel}|${b.key}`}
              className="py-2.5 first:pt-0 last:pb-0 group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-1">
                {/* Label + channel badge */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="inline-block w-1 h-5 rounded-sm shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span
                    className="font-mono text-xs sm:text-sm font-medium text-shikho-indigo-900 break-words leading-tight min-w-0"
                    title={b.key}
                  >
                    {b.key}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
                    style={{ color, backgroundColor: `${color}15` }}
                  >
                    {CHANNEL_LABEL[b.channel]}
                  </span>
                </div>
                {/* Right-aligned values */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="font-display text-sm sm:text-base font-semibold text-shikho-indigo-900 tabular-nums">
                    {fmtUSD(b.spend)}
                  </span>
                  <span className="text-[11px] text-ink-muted tabular-nums w-10 text-right">
                    {fmtPct(b.share)}
                  </span>
                  {showAdCount && (
                    <span className="text-[11px] text-ink-muted tabular-nums w-12 text-right">
                      {fmtNum(b.ads)} ads
                    </span>
                  )}
                  {deltaPill && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums shrink-0 ${deltaPill.cls}`}
                    >
                      {deltaPill.txt}
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div
                className="mt-2 h-1 rounded-full bg-ink-50 overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(b.share * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${b.key} ${fmtPct(b.share)} of total spend`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-220 ease-shikho-out"
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {truncated > 0 && (
        <div className="text-[11px] text-ink-muted pt-3 leading-snug">
          + {fmtNum(truncated)} smaller {truncated === 1 ? "bucket" : "buckets"} not shown
        </div>
      )}
    </div>
  );
}
