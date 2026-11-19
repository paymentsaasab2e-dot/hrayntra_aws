import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)'
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)'
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)'
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)'
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)'
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)'
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        brand: {
          green: "#10b981",
          "green-dark": "#059669",
          navy: "#0f1729",
          "navy-light": "#152040",
          "content-bg": "#f8fafc",
          "text-primary": "#0f172b",
          "text-muted": "#90a1b9",
          "text-sub": "#62748e",
          "border-light": "#e2e8f0",
        },
        ds: {
          brand: {
            green:          "#10b981",
            "green-dark":   "#059669",
            "green-light":  "#d1fae5",
            navy:           "#1a1d2e",
            "navy-light":   "#252a3d",
            accent:         "#06b6d4",
            indigo:         "#6366f1",
            blue:           "#3b82f6",
          },
          success: {
            DEFAULT: "#10b981",
            light:   "#d1fae5",
            dark:    "#059669",
            text:    "#065f46",
            border:  "#a7f3d0",
          },
          warning: {
            DEFAULT: "#f59e0b",
            light:   "#fef3c7",
            dark:    "#d97706",
            text:    "#92400e",
            border:  "#fcd34d",
          },
          danger: {
            DEFAULT: "#ef4444",
            light:   "#fee2e2",
            dark:    "#dc2626",
            text:    "#7f1d1d",
            border:  "#fecaca",
          },
          info: {
            DEFAULT: "#3b82f6",
            light:   "#dbeafe",
            dark:    "#2563eb",
            text:    "#1e3a8a",
            border:  "#93c5fd",
          },
          neutral: {
            50:  "#f8fafc",
            100: "#f1f5f9",
            200: "#e2e8f0",
            300: "#cbd5e1",
            400: "#94a3b8",
            500: "#64748b",
            600: "#475569",
            700: "#334155",
            800: "#1e293b",
            900: "#0f172b",
          },
          surface: {
            page: "#f8fafc",
            card: "#ffffff",
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontSize: {
        // ── ds-* type scale — use text-ds-body-sm, text-ds-label, etc.
        'ds-micro':       ['10px', { lineHeight: '14px', fontWeight: '700', letterSpacing: '0.05em' }],
        'ds-caption':     ['11px', { lineHeight: '16px', fontWeight: '600' }],
        'ds-label':       ['12px', { lineHeight: '16px', fontWeight: '700' }],
        'ds-label-upper': ['11px', { lineHeight: '16px', fontWeight: '700', letterSpacing: '0.06em' }],
        'ds-body-xs':     ['12px', { lineHeight: '18px' }],
        'ds-body-sm':     ['13px', { lineHeight: '20px' }],
        'ds-body':        ['14px', { lineHeight: '20px' }],
        'ds-heading-sm':  ['16px', { lineHeight: '24px', fontWeight: '700' }],
        'ds-heading':     ['20px', { lineHeight: '28px', fontWeight: '700' }],
        'ds-display':     ['28px', { lineHeight: '36px', fontWeight: '700' }],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "slide-right": "slideRight 3s ease-in-out infinite",
      },
      keyframes: {
        slideRight: {
          "0%, 100%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(350%)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
