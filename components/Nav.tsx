"use client";

// Top nav. Two states:
//   - md+: horizontal tab strip
//   - <md: dropdown <select> (per the project mobile checklist —
//     overflow-x-auto tab strips are invisible nav on phones)
//
// Active route is highlighted server-side via usePathname(). Routes
// list is the single source of truth — add a new route here, it
// shows up in both the desktop strip and the mobile dropdown.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const ROUTES: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/spend", label: "Spend" },
  { href: "/conversions", label: "Conversions" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <nav className="border-b border-ink-100 bg-ink-paper">
      <div className="max-w-7xl mx-auto px-4">
        <div className="hidden md:flex items-center gap-1 h-12">
          {ROUTES.map((r) => {
            const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
            return (
              <Link
                key={r.href}
                href={r.href}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-140 ${
                  active
                    ? "bg-shikho-indigo-50 text-shikho-indigo-700"
                    : "text-ink-secondary hover:text-ink-900 hover:bg-ink-50"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
          {pending && (
            <span className="text-xs text-ink-muted ml-2 animate-pulse" role="status">
              loading…
            </span>
          )}
        </div>
        <div className="md:hidden py-2">
          <select
            value={pathname}
            onChange={(e) => start(() => router.push(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-ink-50 border border-ink-100 rounded-md"
            aria-label="Navigate to"
          >
            {ROUTES.map((r) => (
              <option key={r.href} value={r.href}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}
