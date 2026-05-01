// Shikho v1.0 KPI card. Adapted from organic-social-dashboard:
//   - paper → indigo-50 gradient ground that reads cleanly behind the value
//   - text-2xl on mobile, text-3xl sm+, break-words + leading-tight so
//     7-digit values don't overflow a 2-col grid at 360px
//   - delta uses brand semantics: ok green for positive, coral for negative
//   - optional channel pill (Meta/Google) keeps platform identity visible
//
// Backwards-compatible: legacy callers pass `accent` (hex) which still
// drives the pill background. New callers can use `delta` (signed %) +
// `deltaAbs` (formatted USD/string) for richer comparisons.

import { Card } from "./Card";

type Props = {
  label: string;
  value: string | number;
  /** Signed percentage delta vs comparison period (e.g. 12.4 for +12.4%).
   *  When provided, renders below the value with semantic color. */
  delta?: number;
  /** Optional secondary delta text — typically the absolute USD delta
   *  when `delta` is the percentage (e.g. "+$1.2K"). */
  deltaAbs?: string;
  /** Static hint shown when `delta` is undefined (e.g. "30d window"). */
  hint?: string;
  /** Channel/source pill on the top right — Meta blue or Google red. */
  pillLabel?: string;
  /** New name for the pill background hex. */
  pillColor?: string;
  /** Legacy alias for pillColor — kept so existing pages don't break. */
  accent?: string;
  /** Plain-English explainer shown on hover/tap of the label. */
  labelTooltip?: string;
};

export default function KpiCard({
  label,
  value,
  delta,
  deltaAbs,
  hint,
  pillLabel,
  pillColor,
  accent,
  labelTooltip,
}: Props) {
  const pillBg = pillColor || accent || "#252F73";
  const deltaColor =
    delta === undefined
      ? ""
      : delta > 0
      ? "text-ok"
      : delta < 0
      ? "text-bad"
      : "text-ink-secondary";
  const deltaText =
    delta !== undefined
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`
      : null;

  return (
    <Card className="!bg-gradient-to-br from-ink-paper to-shikho-indigo-50/40">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary ${
              labelTooltip
                ? "cursor-help underline decoration-dotted decoration-ink-200 underline-offset-2"
                : ""
            }`}
            title={labelTooltip}
          >
            {label}
          </span>
          {pillLabel && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ background: pillBg }}
            >
              {pillLabel}
            </span>
          )}
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-shikho-indigo-900 mt-2 break-words leading-tight tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="mt-2 min-h-[18px] text-xs leading-snug break-words">
          {deltaText && (
            <span className={`${deltaColor} font-semibold`}>{deltaText}</span>
          )}
          {deltaAbs && (
            <span className="text-ink-muted ml-1.5 font-mono tabular-nums">
              {deltaAbs}
            </span>
          )}
          {hint && !deltaText && !deltaAbs && (
            <span className="text-ink-muted">{hint}</span>
          )}
          {hint && (deltaText || deltaAbs) && (
            <span className="text-ink-muted ml-1.5">{hint}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
