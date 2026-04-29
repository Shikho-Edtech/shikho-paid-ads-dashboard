// Compact bar showing each channel's last-run status. Empty data is the
// expected state for Google until the pipeline runs post-Basic-Access.

import type { RunStatus } from "@/lib/types";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "@/lib/colors";

interface Props {
  status: RunStatus;
  metaHasData: boolean;
  googleHasData: boolean;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function ChannelChip({
  channel,
  hasData,
  lastRunAt,
  status,
}: {
  channel: "meta" | "google";
  hasData: boolean;
  lastRunAt: string | null;
  status: string | null;
}) {
  const label = CHANNEL_LABEL[channel];
  const color = CHANNEL_COLOR[channel];
  const ok = hasData && (status === "success" || !!status);
  const dotColor = ok ? "#10A36C" : !hasData ? "#B6BBC8" : "#E0A010";
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-paper border border-ink-100">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: dotColor }}
        aria-hidden
      />
      <span
        className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
        style={{ background: color }}
      >
        {label}
      </span>
      <span className="text-xs text-ink-secondary">
        {hasData ? `last run ${ago(lastRunAt)}` : "no data yet"}
      </span>
    </div>
  );
}

export default function ChannelStatus({
  status,
  metaHasData,
  googleHasData,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <ChannelChip
        channel="meta"
        hasData={metaHasData}
        lastRunAt={status.meta_last_run_at}
        status={status.meta_status}
      />
      <ChannelChip
        channel="google"
        hasData={googleHasData}
        lastRunAt={status.google_last_run_at}
        status={status.google_status}
      />
    </div>
  );
}
