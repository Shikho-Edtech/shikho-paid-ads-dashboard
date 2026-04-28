// KPI card with optional channel accent. Mobile-safe: big values use
// responsive sizes + break-words, secondary copy clamps with leading-tight.

interface Props {
  label: string;
  value: string;
  hint?: string;
  accent?: string; // hex; defaults to indigo-700
  pillLabel?: string;
}

export default function KpiCard({ label, value, hint, accent, pillLabel }: Props) {
  const accentColor = accent || "#252F73";
  return (
    <div
      className="
        rounded-2xl bg-ink-paper p-4 sm:p-5
        border border-ink-100 shadow-ambient
        flex flex-col gap-2
      "
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-muted font-semibold">
          {label}
        </span>
        {pillLabel && (
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
            style={{ background: accentColor }}
          >
            {pillLabel}
          </span>
        )}
      </div>
      <div
        className="text-xl sm:text-2xl font-bold break-words leading-tight tabular-nums"
        style={{ color: accentColor }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-ink-secondary leading-snug">{hint}</div>
      )}
    </div>
  );
}
