# @hryantra/ui — Design System

> The single source of UI truth for HRYantra Payroll.
> **Use these components. Never duplicate them.**

---

## 📦 What's In Here

```
src/
├── tokens/          ← Colors, typography, spacing, radius, shadows
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   └── radius.ts
├── atoms/           ← Smallest building blocks
│   ├── Button.tsx       ← Primary CTA, outline, ghost, destructive, toggle, icon
│   ├── Spinner.tsx      ← Loading indicator (xs/sm/md, white/brand/muted)
│   ├── Input.tsx        ← Text input + Select with icon slots
│   ├── Badge.tsx        ← StatusBadge + SeverityBadge
│   └── Avatar.tsx       ← Initials avatar + NavBadge
├── molecules/       ← Composed atoms
│   ├── ModalWrapper.tsx ← Centered modal + ConfirmDialog
│   ├── DrawerWrapper.tsx← Right-slide panel
│   └── FormField.tsx    ← FormField + FormGrid + FormSection
└── index.ts         ← Single import point
```

---

## 🚀 Quick Start

```tsx
import { Button, Input, StatusBadge, ModalWrapper } from '@hryantra/ui'

// Button
<Button variant="default" size="md" loading={saving}>Save</Button>
<Button variant="outline" onClick={onClose}>Cancel</Button>
<Button variant="destructive" loading={deleting}>Delete</Button>

// Input with icon
<Input
  size="md"
  leftIcon={<Search className="size-4" />}
  placeholder="Search employees..."
/>

// Status badge — no more inline className conditionals
<StatusBadge status="Active" />
<StatusBadge status="On Leave" />
<SeverityBadge level="High" />

// Modal — replaces your 12 manual overlay+panel+header+footer builds
<ModalWrapper
  open={open}
  onClose={onClose}
  title="Onboard Employee"
  size="xl"
  footer={
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button loading={saving} onClick={handleSave}>Save</Button>
    </>
  }
>
  {/* your form content */}
</ModalWrapper>

// Drawer — replaces your 4 manual slide-panel builds
<DrawerWrapper
  open={open}
  onClose={onClose}
  title="Employee Profile"
  size="lg"
>
  {/* content */}
</DrawerWrapper>

// Form field — replaces 20+ label+input+error blocks
<FormField label="Corporate Email" required error={errors.email}>
  <Input type="email" />
</FormField>
```

---

## ⚖️ Design Rules

### ALWAYS
- ✅ Use a component from this package for UI elements
- ✅ Use semantic color tokens (`colors.success.DEFAULT`) not raw hex values
- ✅ Use `StatusBadge` / `SeverityBadge` for all status displays
- ✅ Use `ModalWrapper` for all dialogs — never build a raw overlay
- ✅ Use `DrawerWrapper` for all side panels — never build a raw slide panel
- ✅ Use `FormField` for all form inputs — never raw `<label> + <input>` duos
- ✅ Use `Button[loading]` for async actions — never inline spinners

### NEVER
- ❌ Don't hardcode hex values (`color: '#10b981'`)
- ❌ Don't copy-paste modal/drawer/form scaffolding
- ❌ Don't build custom status badge conditionals
- ❌ Don't create a new button with custom Tailwind — extend this Button
- ❌ Don't use raw `<input>` or `<button>` in page/module components

---

## 🎨 Design Tokens

```ts
import { colors, fontSize, borderRadius, shadows } from '@hryantra/ui'

// Colors
colors.brand.green         // '#10b981' — primary
colors.semantic.success    // { DEFAULT, light, dark, text, border }
colors.semantic.warning    // { DEFAULT, light, dark, text, border }
colors.semantic.danger     // { DEFAULT, light, dark, text, border }
colors.neutral[200]        // '#e2e8f0' — border
colors.neutral[900]        // '#0f172b' — text

// Typography names → used in Tailwind as text-body-sm, text-label, etc.
// micro, caption, label, label-upper, body-sm, body, heading-sm, heading, display
```

---

## 📋 Component Status

| Component | Status | Phase |
|-----------|--------|-------|
| `Button` | ✅ Done | 1 |
| `Spinner` | ✅ Done | 1 |
| `Input` + `Select` | ✅ Done | 1 |
| `StatusBadge` + `SeverityBadge` | ✅ Done | 1 |
| `Avatar` + `NavBadge` | ✅ Done | 1 |
| `ModalWrapper` + `ConfirmDialog` | ✅ Done | 2 |
| `DrawerWrapper` | ✅ Done | 2 |
| `FormField` + `FormGrid` + `FormSection` | ✅ Done | 2 |
| `DataTable` (full rewrite) | 🔴 TODO | 2 |
| `Pagination` | 🔴 TODO | 2 |
| `EmptyState` | 🔴 TODO | 2 |
| `TabsNav` | 🔴 TODO | 2 |
| `SectionCard` | 🔴 TODO | 2 |
| `FilterBar` (generic) | 🔴 TODO | 3 |
| `ActionDropdown` (generic) | 🔴 TODO | 3 |
| `FileUpload` | 🔴 TODO | 3 |
| `PageHeader` | 🔴 TODO | 3 |

---

## 🔌 Integration

This package is co-located in `packages/ui/`. The payroll app imports it via path alias.

In `payroll-app/tsconfig.json`:
```json
{
  "paths": {
    "@hryantra/ui": ["../packages/ui/src/index.ts"],
    "@hryantra/ui/*": ["../packages/ui/src/*"]
  }
}
```
