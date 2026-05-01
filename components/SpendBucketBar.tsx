// Single horizontal bar list for a spend dimension breakdown.
// Renders Meta + Google buckets in one list, color-coded by channel.
// Mobile-first: at 360px the right-hand $/% column wraps under the
// label rather than off-screen. No hover-only affordances.
//
// `delta` (when present) is shown as a signed pill: green for spend
// increase, magenta for decrease. Sign respects the comparison range.

import type { SpendBucket } from "@/lib/types";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/colors";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/aggregate";

interface Props {
  buckets: SpendBucket[];
  title: string;
  subtitle?: string;
  emptyText?: string;
  // If true, an extra column shows distinct ad count per bucket.
  showAdCount?: boolean;
  // Optional fixed max for proportional bar widths. If absent we use
  // the largest bucket as 100%.
  maxSpend?: number;
}

export default function SpendBucketBar({
  buckets,
  title,
  subtitle,
  emptyText = "No spend in the selected range.",
  showAdCount = false,
  maxSpend,
}: Props) {
  const max = maxSpend ?? Math.max(0, ...buckets.map((b) => b.spend));

  return (
    <section className="rounded-lg border border-ink-100 bg-ink-paper p-4 sm:p-5">
      <header className="mb-3">
        <h3 className="font-display text-sm sm:text-base font-semibold text-ink-900 leading-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-ink-muted mt-0.5 leading-snug">
            {subtitle}
          </p>
        )}
      </header>
      {buckets.length === 0 ? (
        <p className="text-xs text-ink-muted py-3">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {buckets.map((b) => {
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
                      cls: "bg-shikho-magenta-50 text-shikho-magenta-700",
                    }
                : null;
            return (
              <li key={`${b.channel}|${b.key}`} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-mono font-medium text-ink-900 break-words"
                      title={b.key}
                    >
                      {b.key}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-wide text-ink-muted shrink-0"
                      style={{ color }}
                    >
                      {CHANNEL_LABEL[b.channel]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-ink-secondary tabular-nums">
                    <span className="font-mono font-semibold text-ink-900">
                      {fmtUSD(b.spend)}
                    </span>
                    <span className="text-ink-muted text-[11px]">
                      {fmtPct(b.share)}
                    </span>
                    {showAdCount && (
                      <span className="text-ink-muted text-[11px]">
                        · {fmtNum(b.ads)} ads
                      </span>
                    )}
                    {deltaPill && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${deltaPill.cls}`}
                      >
                        {deltaPill.txt}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="h-1.5 rounded-full bg-ink-50 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(b.share * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${b.key} ${fmtPct(b.share)} of total spend`}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
