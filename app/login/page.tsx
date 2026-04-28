"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push(params.get("next") || "/");
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-brand-canvas">
      {/* Left brand panel */}
      <div className="relative lg:flex-1 overflow-hidden bg-shikho-indigo-700 flex flex-col justify-between p-8 lg:p-12 min-h-[240px] lg:min-h-screen">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-shikho-magenta-500/25 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-shikho-sunrise-500/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-channel-meta/30 blur-3xl" />

        {/* Top: wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center text-shikho-indigo-700 font-bold text-2xl">
            S
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">Shikho</div>
            <div className="text-white/70 text-xs leading-tight tracking-wide">
              Paid Ads Intelligence
            </div>
          </div>
        </div>

        {/* Middle: tagline + workflow */}
        <div className="relative z-10 max-w-lg">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-shikho-magenta-200 mb-3">
            Cross-channel paid media, daily
          </div>
          <h1 className="text-white text-3xl lg:text-[44px] font-bold leading-[1.05] tracking-tight">
            Every campaign, <span className="text-shikho-magenta-200">measured</span>.<br />
            Every funnel stage, <span className="text-shikho-sunrise-200">surfaced</span>.
          </h1>
          <p className="text-white/75 text-sm lg:text-base mt-5 leading-relaxed">
            A unified view of Shikho&apos;s paid media spend, results and audience
            mix across Meta, Google Ads and (soon) every active platform.
          </p>
        </div>

        {/* Bottom: attribution */}
        <div className="relative z-10 text-white/55 text-xs leading-snug">
          <div className="font-semibold text-white/85">Prepared by Shahriar</div>
          <div>Performance &amp; Growth Marketing</div>
        </div>
      </div>

      {/* Right form */}
      <div className="lg:flex-1 flex items-center justify-center px-6 py-10 lg:py-0">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shikho-indigo-700 mb-2">
              Team access
            </div>
            <div className="text-ink-900 text-2xl font-bold leading-tight">
              Sign in
            </div>
            <p className="text-ink-secondary text-sm mt-2 leading-relaxed">
              Internal tool. Enter the shared team password to continue.
            </p>
          </div>

          <label className="block text-ink-700 text-xs font-semibold uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-ink-paper border border-ink-200 rounded-lg text-ink-900 focus:outline-none focus:border-shikho-indigo-600 focus:ring-2 focus:ring-shikho-indigo-600/15 transition-colors"
            placeholder="••••••••"
            autoFocus
          />
          {error && (
            <div className="mt-3 px-3 py-2 rounded-md bg-shikho-coral-50 border border-shikho-coral-100 text-shikho-coral-700 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-5 w-full bg-shikho-indigo-600 hover:bg-shikho-indigo-700 disabled:bg-ink-200 disabled:text-ink-muted text-white font-semibold py-3 rounded-xl transition-all duration-220 ease-shikho-out shadow-indigo-lift hover:shadow-lg active:scale-[0.99]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="mt-8 pt-6 border-t border-ink-100 space-y-2 text-xs text-ink-secondary leading-relaxed">
            <div>
              <span className="font-semibold text-ink-700">Times:</span>{" "}
              Bangladesh Time (UTC+6) throughout.
            </div>
            <div>
              <span className="font-semibold text-ink-700">Currency:</span>{" "}
              All spend values in BDT.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
