// =============================================================================
// @hryantra/ui — Border Radius Tokens
// One source of truth. Pick from these; never use ad-hoc radius values.
// =============================================================================

export const borderRadius = {
  badge:  '4px',    // flat badge — px rounded, used for status/severity badges
  button: '8px',    // rounded-lg — all buttons
  input:  '8px',    // rounded-lg — all text inputs, selects
  card:   '12px',   // rounded-xl — all section cards, modals, drawers
  pill:   '9999px', // rounded-full — notification count bubbles ONLY
} as const

// ─── Shadow Tokens ────────────────────────────────────────────────────────────
export const shadows = {
  card:    '0px 1px 3px rgba(0,0,0,0.04), 0px 1px 2px rgba(0,0,0,0.04)',
  statCard:'0px 2px 8px rgba(0,0,0,0.04)',
  modal:   '0 20px 60px rgba(0,0,0,0.15)',
  drawer:  '0 25px 50px rgba(0,0,0,0.15)',
  dropdown:'0 4px 16px rgba(0,0,0,0.08)',
  ring:    '0 0 0 3px rgba(16,185,129,0.15)',  // focus ring — brand green
} as const
