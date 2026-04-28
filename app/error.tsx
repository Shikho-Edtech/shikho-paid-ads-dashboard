"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-ink-paper rounded-2xl border border-ink-100 shadow-ambient p-6">
        <h1 className="text-xl font-bold text-shikho-coral-600 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-ink-secondary mb-4">
          {error.message ||
            "Couldn't load dashboard data. Likely a Sheets API hiccup or env var missing."}
        </p>
        <button
          onClick={() => reset()}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-shikho-indigo-600 text-white hover:bg-shikho-indigo-700 transition-colors duration-220"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
