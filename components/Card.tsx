// Shikho v1.0 surface card. Adapted from organic-social-dashboard.
// Paper white, ink-100 hairline, 28px (rounded-3xl) radius for headline
// surfaces, ambient shadow. Hover lifts into indigo-tinted shadow.

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Left-border accent. Used to mark provenance:
   *  observed = raw data, derived = computed, channel-meta/-google = source. */
  kind?: "observed" | "derived" | "meta" | "google";
};

const KIND_BORDER: Record<NonNullable<Props["kind"]>, string> = {
  observed: "border-l-4 border-l-shikho-indigo-500",
  derived: "border-l-4 border-l-shikho-magenta-500",
  meta: "border-l-4 border-l-channel-meta",
  google: "border-l-4 border-l-channel-google",
};

export function Card({ children, className = "", kind }: Props) {
  const kindBorder = kind ? KIND_BORDER[kind] : "";
  return (
    <div
      className={`
        bg-ink-paper border border-ink-100 rounded-3xl
        shadow-ambient hover:shadow-indigo-lift
        transition-shadow duration-220 ease-shikho-out
        ${kindBorder}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;       // e.g. row count pill, "vs prior 30d" badge
  caption?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  kind?: Props["kind"];
};

/** ChartCard / SectionCard — header row with title + optional meta pill,
 *  body slot, optional caption. Title row stacks on small screens to
 *  prevent the meta pill from squeezing the title off the right edge. */
export function SectionCard({
  title,
  subtitle,
  meta,
  caption,
  children,
  className = "",
  bodyClassName = "",
  kind,
}: SectionProps) {
  return (
    <Card className={className} kind={kind}>
      <div className="px-5 sm:px-6 pt-5 pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base sm:text-lg font-semibold text-shikho-indigo-900 leading-tight break-words">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-ink-muted mt-1 leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {meta && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted shrink-0">
              {meta}
            </div>
          )}
        </div>
      </div>
      <div className={`px-5 sm:px-6 pb-5 ${bodyClassName}`}>{children}</div>
      {caption && (
        <p className="px-5 sm:px-6 pb-5 -mt-2 text-xs text-ink-muted leading-relaxed">
          {caption}
        </p>
      )}
    </Card>
  );
}
