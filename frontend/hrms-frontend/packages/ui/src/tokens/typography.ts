// =============================================================================
// @hryantra/ui — Typography Tokens
// Named type scale. Use these names, not raw px values in components.
// =============================================================================

export const fontSize = {
  // Name         [size,   { lineHeight, letterSpacing, fontWeight }]
  'micro':        ['10px', { lineHeight: '14px', letterSpacing: '0.05em',  fontWeight: '700' }],
  'caption':      ['11px', { lineHeight: '16px', letterSpacing: '0',        fontWeight: '600' }],
  'label':        ['12px', { lineHeight: '16px', letterSpacing: '0',        fontWeight: '700' }],
  'label-upper':  ['11px', { lineHeight: '16px', letterSpacing: '0.06em',  fontWeight: '700' }],
  'body-xs':      ['12px', { lineHeight: '18px', letterSpacing: '0',        fontWeight: '400' }],
  'body-sm':      ['13px', { lineHeight: '20px', letterSpacing: '0',        fontWeight: '500' }],
  'body':         ['14px', { lineHeight: '20px', letterSpacing: '0',        fontWeight: '400' }],
  'body-md':      ['14px', { lineHeight: '20px', letterSpacing: '0',        fontWeight: '600' }],
  'heading-sm':   ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '700' }],
  'heading':      ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
  'heading-lg':   ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '700' }],
  'display':      ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '700' }],
} as const

// ─── Usage guide ──────────────────────────────────────────────────────────────
// micro       → table column headers, stat card labels (uppercase)
// caption     → timestamps, sub-labels inside cards
// label       → form field labels
// label-upper → sidebar section labels (uppercase tracking)
// body-sm     → table cell text, modal body
// body        → default page text
// body-md     → bold body (card titles, row emphasis)
// heading-sm  → section card titles, drawer sub-headers
// heading     → modal titles, sidebar section
// heading-lg  → drawer/panel titles
// display     → page H1

export const fontFamily = {
  sans: ['Arimo', 'Inter', 'system-ui', 'sans-serif'],
} as const
