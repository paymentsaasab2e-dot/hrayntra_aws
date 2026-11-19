export type TenantPackageKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'

export type TenantPackageInfo = {
  key: TenantPackageKey
  label: string
  description: string
  maxUsers: number
  enabledTabs: string[]
  enabledActions: string[]
}

export const PACKAGE_LABELS: Record<TenantPackageKey, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
}

export const PACKAGE_COLORS: Record<TenantPackageKey, string> = {
  STARTER: 'bg-slate-100 text-slate-700 border-slate-200',
  PROFESSIONAL: 'bg-blue-50 text-blue-700 border-blue-200',
  ENTERPRISE: 'bg-violet-50 text-violet-700 border-violet-200',
}
