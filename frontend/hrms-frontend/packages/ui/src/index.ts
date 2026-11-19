// =============================================================================
// @hryantra/ui — Package Entry Point
// Import everything from here. Never deep-import from src/.
//
// Usage:
//   import { Button, Input, StatusBadge, ModalWrapper } from '@hryantra/ui'
//   import { colors } from '@hryantra/ui/tokens'
// =============================================================================

// ─── Design Tokens ────────────────────────────────────────────────────────────
export * from './tokens'

// ─── Atoms ───────────────────────────────────────────────────────────────────
export { Button, buttonVariants } from './atoms/Button'
export type { ButtonProps } from './atoms/Button'

export { Spinner } from './atoms/Spinner'
export type { SpinnerProps } from './atoms/Spinner'

// Input — v2: no wrapper div, id flows to native element via ...props spread
export { Input, Select, Textarea, InputWrapper, inputWithIconVariants } from './atoms/Input'
export type { InputProps, SelectProps, TextareaProps, InputWrapperProps } from './atoms/Input'

export { StatusBadge, SeverityBadge } from './atoms/Badge'
export type { StatusBadgeProps, SeverityBadgeProps } from './atoms/Badge'

export { Avatar, NavBadge } from './atoms/Avatar'
export type { AvatarProps, NavBadgeProps } from './atoms/Avatar'

// ─── Molecules ────────────────────────────────────────────────────────────────
// ModalWrapper — v2: conditional header, justify-end footer, aria-modal, shared scroll lock
export { ModalWrapper, ConfirmDialog } from './molecules/ModalWrapper'
export type { ModalWrapperProps, ConfirmDialogProps } from './molecules/ModalWrapper'

// DrawerWrapper — v2: mount/visible state split (exit animation works), aria-modal
export { DrawerWrapper } from './molecules/DrawerWrapper'
export type { DrawerWrapperProps } from './molecules/DrawerWrapper'

export {
  FilterDrawer,
  FilterTriggerButton,
  FilterField,
  FILTER_FIELD_LABEL,
  FILTER_INPUT_CLASS,
} from './molecules/FilterDrawer'
export type {
  FilterDrawerProps,
  FilterTriggerButtonProps,
  FilterFieldProps,
} from './molecules/FilterDrawer'

// FormField — v2: context-based id/aria-invalid, no cloneElement, hint shows alongside error
export {
  FormField,
  FormGrid,
  FormSection,
  FormFieldInput,
  useFormField,
} from './molecules/FormField'
export type { FormFieldProps, FormGridProps, FormSectionProps } from './molecules/FormField'

export { SectionCard } from './molecules/SectionCard'
export type { SectionCardProps } from './molecules/SectionCard'

export { MetricStatCard } from './molecules/MetricStatCard'
export type { MetricStatCardProps, MetricStatTone } from './molecules/MetricStatCard'

export { SegmentedControl, FilterChips } from './molecules/SegmentedControl'
export type {
  SegmentedControlProps,
  SegmentedControlOption,
  FilterChipsProps,
  FilterChipOption,
} from './molecules/SegmentedControl'

// ─── Data Display ────────────────────────────────────────────────────────────
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './atoms/Table'

export { DataTable } from './data/DataTable'
export type { DataTableProps, ColumnDef, SortDirection } from './data/DataTable'

export { EmptyState } from './data/EmptyState'
export type { EmptyStateProps } from './data/EmptyState'

export { Pagination } from './data/Pagination'
export type { PaginationProps } from './data/Pagination'

// ─── Layout ──────────────────────────────────────────────────────────────────
export { PageHeader } from './layout/PageHeader'
export type { PageHeaderProps } from './layout/PageHeader'

export { PageHeroBanner } from './layout/PageHeroBanner'
export type { PageHeroBannerProps } from './layout/PageHeroBanner'

// ─── Utilities ────────────────────────────────────────────────────────────────
export { cn } from './utils'
