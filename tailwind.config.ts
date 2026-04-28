import type { Config } from "tailwindcss";

// Shikho design system v1.0 — same hex values as the organic-social-dashboard.
// Single source of truth for the dashboard's hex, type, radii, shadows.
// Tokens consumed by components; never inline raw hex.

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Poppins",
          "Hind Siliguri",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        display: ["Poppins", "system-ui", "sans-serif"],
        bangla: ["Hind Siliguri", "Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        shikho: {
          indigo: {
            50: "#EEF0FA", 100: "#DCE0F3", 200: "#B9C0E5", 300: "#959FD4",
            400: "#717DC3", 500: "#4F5EAE", 600: "#304090", 700: "#252F73",
            800: "#1A2155", 900: "#0F1438",
          },
          magenta: {
            50: "#FAE7F2", 100: "#F4CFE5", 200: "#EAA0CC", 300: "#DF70B2",
            400: "#D34099", 500: "#C02080", 600: "#A11A6D", 700: "#811555",
            800: "#60113E", 900: "#410B2B",
          },
          sunrise: {
            50: "#FCF1D9", 100: "#F9E3B3", 200: "#F4CC75", 300: "#EFB638",
            400: "#E9A019", 500: "#E0A010", 600: "#B7820A", 700: "#8E6307",
            800: "#664605", 900: "#3D2A03",
          },
          coral: {
            50: "#FCE6EA", 100: "#F8CCD3", 200: "#F19BA9", 300: "#EA6B7E",
            400: "#E33A53", 500: "#E03050", 600: "#B72540", 700: "#8E1B30",
            800: "#651320", 900: "#3D0B14",
          },
        },
        // Channel accents — Meta blue + Google blue for cross-channel views
        channel: {
          meta: "#1877F2",
          google: "#4285F4",
        },
        // Functional neutral scale (Canvas + Paper)
        ink: {
          paper: "#FFFFFF",
          50: "#FAFAFB", 100: "#F0F1F4", 200: "#DCDFE6", 300: "#B6BBC8",
          400: "#8B91A3", 500: "#646A7E", 600: "#454A5C", 700: "#2F3344",
          800: "#1F2233", 900: "#11142A",
          muted: "#646A7E",
          secondary: "#454A5C",
        },
        brand: {
          canvas: "#F4F5FA",
        },
        // Status hues
        ok: "#10A36C",
        warn: "#E0A010",
        bad: "#E03050",
      },
      borderRadius: {
        sm: "4px", md: "8px", lg: "12px", xl: "16px", "2xl": "20px", "3xl": "28px",
      },
      boxShadow: {
        ambient: "0 1px 2px rgba(15, 20, 56, 0.04), 0 1px 1px rgba(15, 20, 56, 0.06)",
        "indigo-lift": "0 8px 24px -4px rgba(48, 64, 144, 0.18), 0 2px 6px -1px rgba(48, 64, 144, 0.10)",
      },
      transitionTimingFunction: {
        "shikho-out": "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      transitionDuration: {
        "140": "140ms", "220": "220ms", "420": "420ms",
      },
    },
  },
  plugins: [],
};

export default config;
