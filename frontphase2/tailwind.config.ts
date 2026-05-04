import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      colors: {
        ph2: {
          ink: '#0f172a',
          muted: '#64748b',
          surface: '#f8fafc',
          ring: 'rgba(37, 99, 235, 0.08)',
          blue: { DEFAULT: '#2563eb', soft: '#eff6ff' },
          teal: { DEFAULT: '#0d9488', soft: '#ccfbf1' },
          rose: { DEFAULT: '#e11d48', soft: '#ffe4e6' },
          amber: { DEFAULT: '#d97706', soft: '#fffbeb' },
          violet: { DEFAULT: '#7c3aed', soft: '#ede9fe' },
          emerald: { DEFAULT: '#059669', soft: '#d1fae5' },
          cyan: { DEFAULT: '#0891b2', soft: '#cffafe' },
          indigo: { DEFAULT: '#4f46e5', soft: '#e0e7ff' },
          orange: { DEFAULT: '#ea580c', soft: '#ffedd5' },
          fuchsia: { DEFAULT: '#c026d3', soft: '#fae8ff' },
        },
      },
      boxShadow: {
        'ph2-card':
          '0 1px 2px rgb(15 23 42 / 0.05), 0 0 0 1px rgb(59 130 246 / 0.06)',
        'ph2-card-hover':
          '0 8px 24px -6px rgb(37 99 235 / 0.14), 0 0 0 1px rgb(191 219 254 / 0.9)',
      },
    },
  },
  plugins: [],
};
export default config;
