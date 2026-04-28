import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shikho Paid Ads",
  description:
    "Cross-channel paid media reporting — Meta + Google Ads spend, results, and funnel-stage breakdowns.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Poppins + Hind Siliguri — same families as the organic dashboard */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-brand-canvas text-ink-900 font-sans">
        {children}
      </body>
    </html>
  );
}
