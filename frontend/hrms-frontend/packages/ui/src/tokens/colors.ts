// =============================================================================
// @hryantra/ui — Color Tokens
// Single source of truth for all colors in the design system.
// NEVER hardcode hex values outside this file.
// =============================================================================

export const colors = {
  // ─── Brand ──────────────────────────────────────────────────────────────────
  brand: {
    green:       '#10b981',   // Primary CTA, success accents
    greenDark:   '#059669',   // Hover state for green buttons
    greenLight:  '#d1fae5',   // Green background tints
    navy:        '#1a1d2e',   // Sidebar background
    navyLight:   '#252a3d',   // Sidebar hover / secondary bg
    accent:      '#06b6d4',   // Active nav cyan accent bar
    indigo:      '#6366f1',   // Gradient end for active nav
    blue:        '#3b82f6',   // Gradient start for active nav
  },

  // ─── Semantic ────────────────────────────────────────────────────────────────
  // Use these for status communication, never raw hex
  success: {
    DEFAULT:  '#10b981',
    light:    '#d1fae5',
    dark:     '#059669',
    text:     '#065f46',
    border:   '#a7f3d0',
  },
  warning: {
    DEFAULT:  '#f59e0b',
    light:    '#fef3c7',
    dark:     '#d97706',
    text:     '#92400e',
    border:   '#fcd34d',
  },
  danger: {
    DEFAULT:  '#ef4444',
    light:    '#fee2e2',
    dark:     '#dc2626',
    text:     '#7f1d1d',
    border:   '#fecaca',
  },
  info: {
    DEFAULT:  '#3b82f6',
    light:    '#dbeafe',
    dark:     '#2563eb',
    text:     '#1e3a8a',
    border:   '#93c5fd',
  },

  // ─── Neutral Scale ───────────────────────────────────────────────────────────
  neutral: {
    50:  '#f8fafc',   // Page background (--content-bg)
    100: '#f1f5f9',   // Muted backgrounds
    200: '#e2e8f0',   // Borders, dividers (--border-light)
    300: '#cbd5e1',   // Scrollbar, subtle borders
    400: '#94a3b8',   // Placeholder text, muted icons (--text-muted)
    500: '#64748b',   // Secondary text, sub-labels
    600: '#475569',   // Body text medium
    700: '#334155',   // --text-sub (#62748e approx)
    800: '#1e293b',   // Heavy body
    900: '#0f172b',   // Primary text (--text-primary)
  },

  // ─── Surface ─────────────────────────────────────────────────────────────────
  surface: {
    page:    '#f8fafc',   // Main page background
    card:    '#ffffff',   // Card / panel background
    overlay: 'rgba(15, 23, 42, 0.5)',  // Modal/drawer backdrop
  },
} as const

// ─── Shorthand aliases (for Tailwind config mapping) ─────────────────────────
export type ColorToken = typeof colors
