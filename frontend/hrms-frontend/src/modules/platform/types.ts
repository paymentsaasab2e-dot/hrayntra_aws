import { TenantPackageKey } from '@/shared/tenant-packages'

export type TenantStats = {
  userCount: number
  orgUnitCount: number
  employeeCount: number
  pendingApprovals: number
  activeUsers: number
  managers?: number
  usersByRole?: Record<string, number>
  usersByStatus?: Record<string, number>
  byHierarchyLevel?: { levelOrder: number; orgUnitCount: number; userCount: number }[]
}

export type HierarchyLevel = {
  id?: string
  levelOrder: number
  code: string
  displayName: string
  isLeaf: boolean
}

export type TenantRow = {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  packageKey: TenantPackageKey
  packageLabel: string
  maxUsers: number
  stats: TenantStats
  hierarchyLevels?: HierarchyLevel[]
  orgUnits?: { id: string; name: string; levelOrder?: number; parentId?: string | null }[]
  provisionedAdminEmail?: string | null
  hasProvisionedCredentials?: boolean
  showUsersLocationColumn?: boolean
  packagePermissions?: { tabs?: Record<string, boolean>; actions?: Record<string, boolean> }
  createdAt: string
}

export type TenantCredentials = {
  tenantId: string
  tenantName: string
  userId: string | null
  email: string | null
  password: string | null
  message?: string | null
}

export const DEFAULT_HIERARCHY_LEVELS: HierarchyLevel[] = [
  { levelOrder: 1, code: 'L1', displayName: 'Main Branch', isLeaf: false },
  { levelOrder: 2, code: 'L2', displayName: 'Division', isLeaf: false },
  { levelOrder: 3, code: 'L3', displayName: 'Site', isLeaf: true },
]

export function hierarchyPathLabel(levels?: HierarchyLevel[]) {
  if (!levels?.length) return 'Main Branch → Division → Site'
  return [...levels]
    .sort((a, b) => a.levelOrder - b.levelOrder)
    .map((l) => l.displayName)
    .join(' → ')
}

export function statusBadgeClass(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600 border-slate-200'
  return 'bg-amber-50 text-amber-800 border-amber-200'
}
