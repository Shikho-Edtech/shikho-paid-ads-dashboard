/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ISR is the default revalidation strategy. Pages using fetch from sheets
  // pass `next: { revalidate: 600 }` (10 min) so we don't hammer Sheets.
};

export default nextConfig;
