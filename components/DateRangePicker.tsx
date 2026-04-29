"use client";

// Date range picker — URL-state driven so the range is bookmarkable
// and the server component re-fetches with the right filter on change.
// Presets cover the realistic windows (7/14/30/60/90); custom uses two
// native date inputs.
//
// Why URL state and not React state: server component renders with the
// filter pre-applied, which means the chart/KPI/explorer all derive
// from a single date-filtered insight set. Client state would force
// us to ship every row to the browser and filter client-side, which
// gets heavy with 6 platforms × 60 days × ad-level data.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

interface Props {
  // Current applied window (server passes this back so we can highlight)
  currentDays: number | null;
  currentStart: string;
  currentEnd: string;
}

export default function DateRangePicker({ currentDays, currentStart, currentEnd }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState(currentStart);
  const [customEnd, setCustomEnd] = useState(currentEnd);

  function applyPreset(days: number) {
    const sp = new URLSearchParams(params.toString());
    sp.set("days", String(days));
    sp.delete("start");
    sp.delete("end");
    start(() => router.push(`/?${sp.toString()}`));
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const sp = new URLSearchParams(params.toString());
    sp.delete("days");
    sp.set("start", customStart);
    sp.set("end", customEnd);
    start(() => {
      router.push(`/?${sp.toString()}`);
      setCustomOpen(false);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex p-0.5 bg-ink-50 rounded-lg border border-ink-100">
        {PRESETS.map((p) => {
          const active = currentDays === p.days;
          return (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              disabled={pending}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors duration-140 ${
                active
                  ? "bg-shikho-indigo-700 text-white shadow-ambient"
                  : "text-ink-muted hover:text-ink-700"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <button
          onClick={() => setCustomOpen((o) => !o)}
          disabled={pending}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors duration-140 ${
            currentDays === null
              ? "bg-shikho-indigo-700 text-white border-shikho-indigo-700"
              : "bg-ink-50 border-ink-100 text-ink-muted hover:text-ink-700"
          }`}
          aria-expanded={customOpen}
        >
          Custom
        </button>
        {customOpen && (
          <div className="absolute right-0 sm:left-0 mt-2 w-72 max-w-[calc(100vw-2rem)] z-10 p-3 rounded-lg bg-ink-paper border border-ink-200 shadow-indigo-lift">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">
              Start
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full mb-2 px-2 py-1.5 text-sm bg-ink-50 border border-ink-200 rounded-md focus:outline-none focus:border-shikho-indigo-600"
            />
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1">
              End
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full mb-3 px-2 py-1.5 text-sm bg-ink-50 border border-ink-200 rounded-md focus:outline-none focus:border-shikho-indigo-600"
            />
            <button
              onClick={applyCustom}
              className="w-full text-xs font-semibold py-2 rounded-md bg-shikho-indigo-600 hover:bg-shikho-indigo-700 text-white"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <span className="text-xs text-ink-muted ml-1">
        {currentStart} → {currentEnd}
      </span>
      {pending && (
        <span
          className="text-xs text-ink-muted animate-pulse"
          role="status"
          aria-live="polite"
        >
          loading…
        </span>
      )}
    </div>
  );
}
