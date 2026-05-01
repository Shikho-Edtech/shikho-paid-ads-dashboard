// Shikho v1.0 page header. Title + optional subtitle on the left;
// "Data as of …" timestamp on the right that stacks under on mobile.
// Adapted from organic-social-dashboard but ink-* tokens only (no slate).

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** ISO timestamp of the most recent pipeline run. Honest answer to
   *  "how fresh is this data?" — render time is misleading because
   *  Next.js can re-render a stale server component long after the
   *  last actual scrape. Pass `runStatus.meta_last_run_at`
   *  (or both, the page picks the older / more conservative one). */
  metaLastRun?: string | null;
  googleLastRun?: string | null;
  /** Right-side controls (date picker, comparison toggle). Stacks
   *  under the title on mobile. */
  rightSlot?: ReactNode;
};

function formatBDT(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export default function PageHeader({
  title,
  subtitle,
  metaLastRun,
  googleLastRun,
  rightSlot,
}: Props) {
  // Show the older of the two pipeline run timestamps so the freshness
  // signal reflects the worst-case data on the page. If only one is
  // present, use it.
  const candidates = [metaLastRun, googleLastRun].filter(Boolean) as string[];
  let oldest: string | null = null;
  for (const t of candidates) {
    if (!oldest || new Date(t).getTime() < new Date(oldest).getTime()) {
      oldest = t;
    }
  }
  const stamp = formatBDT(oldest);

  return (
    <header className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-shikho-indigo-900 tracking-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-secondary mt-1.5 leading-snug max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 self-stretch sm:self-auto shrink-0">
          {rightSlot}
          {stamp && (
            <div className="text-[11px] text-ink-muted leading-tight">
              Data as of <span className="font-medium text-ink-secondary">{stamp} BDT</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
