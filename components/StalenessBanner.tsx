// Per-channel staleness banner.
//
// Why this exists: pipelines fail-soft. A 3-day cron failure with no
// banner = the dashboard renders 3-day-old numbers as if they were
// today's. This is the load-bearing UX defense against silent staleness.
//
// State machine (per channel):
//   - fresh   (<= 26h)        → not surfaced (hidden)
//   - warn    (26-50h)        → yellow chip in the banner
//   - crit    (> 50h or never) → red chip in the banner
//
// Banner renders only when AT LEAST ONE channel is non-fresh. If every
// channel is fresh, returns null.
//
// v1 scope: per-channel surfacing only. When Phase 3 AI stages land,
// extend with the artifact-level pattern from organic-social-dashboard.

import type { RunStatus, Channel } from "@/lib/types";
import { CHANNEL_LABEL } from "@/lib/colors";

type Severity = "fresh" | "warn" | "crit";

interface ChannelHealth {
  channel: Channel;
  severity: Severity;
  lastRunAt: string | null;
  ageHours: number; // -1 if never
}

function ageHours(iso: string | null): number {
  if (!iso) return -1;
  const t = Date.parse(iso);
  if (isNaN(t)) return -1;
  return Math.floor((Date.now() - t) / 3600000);
}

function severity(age: number): Severity {
  if (age < 0) return "crit";
  if (age <= 26) return "fresh";
  if (age <= 50) return "warn";
  return "crit";
}

function fmtAge(age: number): string {
  if (age < 0) return "never";
  if (age < 1) return "< 1h ago";
  if (age < 24) return `${age}h ago`;
  const d = Math.floor(age / 24);
  return `${d}d ago`;
}

function deriveHealth(status: RunStatus): ChannelHealth[] {
  const meta_age = ageHours(status.meta_last_run_at);
  const google_age = ageHours(status.google_last_run_at);
  return [
    {
      channel: "meta",
      severity: severity(meta_age),
      lastRunAt: status.meta_last_run_at,
      ageHours: meta_age,
    },
    {
      channel: "google",
      severity: severity(google_age),
      lastRunAt: status.google_last_run_at,
      ageHours: google_age,
    },
  ];
}

export default function StalenessBanner({
  status,
  channelsExpected,
}: {
  status: RunStatus;
  // Channels that should be reporting. If a channel isn't in this list
  // we suppress its "never" warning (e.g., Google during the early
  // phase before its pipeline has been minted a refresh token).
  channelsExpected?: Channel[];
}) {
  const expected = new Set<Channel>(channelsExpected || ["meta", "google"]);
  const health = deriveHealth(status).filter((h) => expected.has(h.channel));

  // Only surface when at least one expected channel is non-fresh.
  const issues = health.filter((h) => h.severity !== "fresh");
  if (issues.length === 0) return null;

  // Overall banner severity = max of any channel's severity.
  const overall: Severity = issues.some((h) => h.severity === "crit") ? "crit" : "warn";

  const palette =
    overall === "crit"
      ? {
          bg: "bg-shikho-coral-50",
          border: "border-shikho-coral-200",
          text: "text-shikho-coral-700",
          dot: "#E03050",
          icon: "⚠",
        }
      : {
          bg: "bg-shikho-sunrise-50",
          border: "border-shikho-sunrise-200",
          text: "text-shikho-sunrise-700",
          dot: "#E0A010",
          icon: "⚠",
        };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 rounded-xl border ${palette.border} ${palette.bg} p-3 sm:p-4`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${palette.text}`}
            style={{ background: `${palette.dot}22` }}
          >
            {palette.icon}
          </span>
          <span className={`font-semibold ${palette.text}`}>
            {overall === "crit" ? "Data is stale" : "Data may be stale"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          {health.map((h) => (
            <span
              key={h.channel}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-ink-paper border ${
                h.severity === "fresh"
                  ? "border-ink-100 text-ink-secondary"
                  : h.severity === "warn"
                  ? "border-shikho-sunrise-200 text-shikho-sunrise-700"
                  : "border-shikho-coral-200 text-shikho-coral-700"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    h.severity === "fresh"
                      ? "#10A36C"
                      : h.severity === "warn"
                      ? "#E0A010"
                      : "#E03050",
                }}
                aria-hidden
              />
              <span className="font-semibold">{CHANNEL_LABEL[h.channel]}</span>
              <span className="text-[11px]">{fmtAge(h.ageHours)}</span>
            </span>
          ))}
        </div>
      </div>
      <p className={`mt-2 text-xs ${palette.text} opacity-80 leading-snug`}>
        {overall === "crit"
          ? "One or more pipelines have not refreshed in over 50 hours. Numbers below may be wrong. Check the pipeline workflow runs."
          : "One or more pipelines refreshed more than 26 hours ago. The next scheduled run should refresh shortly."}
      </p>
    </div>
  );
}
