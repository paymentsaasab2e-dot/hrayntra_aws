// =============================================================================
// @hryantra/ui — Spacing Tokens
// Based on 4px base unit. All spacing in the app should map to one of these.
// =============================================================================

export const spacing = {
  // Component internal padding
  'card-padding':    '20px',   // p-5  — standard card body
  'card-padding-sm': '16px',   // p-4  — compact card / sidebar item
  'modal-padding':   '24px',   // p-6  — modal body / header / footer
  'section-gap':     '24px',   // gap-6 — between page sections
  'field-gap':       '20px',   // gap-5 — between form fields
  'item-gap':        '16px',   // gap-4 — between list items
  'inline-gap':      '12px',   // gap-3 — between inline elements
  'icon-gap':        '8px',    // gap-2 — icon + label
  'badge-px':        '8px',    // px-2  — badge horizontal padding
  'badge-py':        '2px',    // py-0.5 — badge vertical padding
} as const

// ─── Input heights (standardized) ─────────────────────────────────────────────
export const inputHeight = {
  sm:  '32px',  // h-8  — compact inputs (filter bar, topbar search)
  md:  '40px',  // h-10 — standard form inputs
  lg:  '44px',  // h-11 — prominent inputs (never currently used, future)
} as const
