import {
  ACTION_KEYS,
  PERMISSION_MODULES,
  TAB_KEYS,
  TAB_LABELS,
  TabKey,
  UserPermissions,
} from '@/shared/permissions'

export const TENANT_MODULE_KEYS = TAB_KEYS.filter((k) => k !== 'platformConsole') as TabKey[]

export const PACKAGE_DEFAULT_TABS: Record<string, TabKey[]> = {
  STARTER: ['dashboard', 'employees', 'attendance', 'leave', 'tasks', 'documents'],
  PROFESSIONAL: [
    'dashboard',
    'employees',
    'onboarding',
    'tasks',
    'attendance',
    'leave',
    'timeOff',
    'performance',
    'approvals',
    'documents',
    'reports',
    'locations',
    'orgStructure',
    'userManagement',
  ],
  ENTERPRISE: [...TENANT_MODULE_KEYS],
}

type ModuleLink = {
  tab: TabKey
  needs: TabKey[]
  /** true = must have at least one of `needs` */
  anyOf?: boolean
  severity: 'required' | 'recommended'
  reason: string
}

export const MODULE_CONNECTIONS: ModuleLink[] = [
  {
    tab: 'onboarding',
    needs: ['employees'],
    severity: 'required',
    reason: 'Onboarding creates employee records. Turn on Employees or new joiners have nowhere to land.',
  },
  {
    tab: 'attendance',
    needs: ['employees'],
    severity: 'required',
    reason: 'Attendance punches belong to employees. Without Employees, punch logs have no people.',
  },
  {
    tab: 'leave',
    needs: ['employees'],
    severity: 'required',
    reason: 'Leave applications are tied to employee profiles and balances.',
  },
  {
    tab: 'tasks',
    needs: ['employees'],
    severity: 'required',
    reason: 'Tasks are assigned to employees. Enable Employees so assignees exist.',
  },
  {
    tab: 'assets',
    needs: ['employees'],
    severity: 'required',
    reason: 'Assets are assigned to employees. Enable Employees to allocate hardware.',
  },
  {
    tab: 'documents',
    needs: ['employees'],
    severity: 'recommended',
    reason: 'Documents can be company-wide, but employee-linked files need Employees.',
  },
  {
    tab: 'attendance',
    needs: ['locations'],
    severity: 'recommended',
    reason: 'Geofenced office punch needs Locations (lat/lng + radius). Without it, only remote/manual punch works.',
  },
  {
    tab: 'fieldVisits',
    needs: ['locations'],
    severity: 'required',
    reason: 'Field visits verify arrival against a geofence. Locations must be on.',
  },
  {
    tab: 'fieldVisits',
    needs: ['employees'],
    severity: 'required',
    reason: 'Visit rosters assign employees to sites.',
  },
  {
    tab: 'timeOff',
    needs: ['attendance', 'leave'],
    anyOf: true,
    severity: 'recommended',
    reason: 'Holidays mainly affect Attendance sheets and Leave calendars. Enable at least one.',
  },
  {
    tab: 'performance',
    needs: ['tasks', 'attendance', 'leave'],
    anyOf: true,
    severity: 'required',
    reason: 'Reviews auto-score from Tasks, Attendance, and Leave. Enable at least one source module.',
  },
  {
    tab: 'approvals',
    needs: ['leave', 'attendance', 'orgStructure', 'tasks'],
    anyOf: true,
    severity: 'required',
    reason: 'Approvals inbox is empty without Leave, Attendance late-marks, Org site proposals, or Tasks.',
  },
  {
    tab: 'reports',
    needs: ['attendance', 'leave', 'tasks', 'performance'],
    anyOf: true,
    severity: 'required',
    reason: 'Reports pull Attendance, Leave, Tasks, and Performance. Enable at least one source.',
  },
  {
    tab: 'orgStructure',
    needs: ['userManagement', 'employees'],
    anyOf: true,
    severity: 'recommended',
    reason: 'Org tree is most useful with Users or Employees so people can be bound to sites.',
  },
  {
    tab: 'userManagement',
    needs: ['employees'],
    severity: 'recommended',
    reason: 'User logins are usually linked to employee profiles.',
  },
  {
    tab: 'userManagement',
    needs: ['orgStructure'],
    severity: 'recommended',
    reason: 'Assigning users to a division/site needs Org Structure.',
  },
  {
    tab: 'settings',
    needs: ['leave', 'attendance', 'performance'],
    anyOf: true,
    severity: 'recommended',
    reason: 'Settings hold leave/attendance/performance policy. Enable those modules so policy has an effect.',
  },
  {
    tab: 'locations',
    needs: ['attendance', 'fieldVisits'],
    anyOf: true,
    severity: 'recommended',
    reason: 'Locations (geofences) are used by Attendance punch and Field visits. Enable at least one.',
  },
]

export type ModuleWarning = {
  tab: TabKey
  missing: TabKey[]
  severity: 'required' | 'recommended'
  reason: string
}

export function selectedTabsFromPermissions(permissions?: { tabs?: Partial<Record<string, boolean>> } | null): TabKey[] {
  if (!permissions?.tabs) return PACKAGE_DEFAULT_TABS.STARTER
  return TENANT_MODULE_KEYS.filter((k) => Boolean(permissions.tabs?.[k]))
}

export function getModuleWarnings(selected: TabKey[]): ModuleWarning[] {
  const set = new Set(selected)
  const warnings: ModuleWarning[] = []

  for (const link of MODULE_CONNECTIONS) {
    if (!set.has(link.tab)) continue
    const missing = link.needs.filter((n) => !set.has(n))
    if (link.anyOf) {
      if (missing.length === link.needs.length) {
        warnings.push({ tab: link.tab, missing: link.needs, severity: link.severity, reason: link.reason })
      }
    } else if (missing.length > 0) {
      warnings.push({ tab: link.tab, missing, severity: link.severity, reason: link.reason })
    }
  }

  return warnings
}

export function permissionsFromSelectedTabs(selected: TabKey[]): UserPermissions {
  const tabSet = new Set(selected.filter((k) => k !== 'platformConsole'))
  tabSet.add('dashboard')

  const tabs = Object.fromEntries(TAB_KEYS.map((k) => [k, tabSet.has(k)])) as UserPermissions['tabs']
  tabs.platformConsole = false

  const actions = Object.fromEntries(ACTION_KEYS.map((k) => [k, false])) as UserPermissions['actions']
  actions.platform_manage_tenants = false

  for (const mod of PERMISSION_MODULES) {
    if (mod.tab === 'platformConsole') continue
    if (!tabSet.has(mod.tab)) continue
    for (const action of mod.actions) {
      actions[action] = true
    }
  }

  return { tabs, actions }
}

export function labelList(keys: TabKey[]) {
  return keys.map((k) => TAB_LABELS[k] || k).join(', ')
}

export function relatedTabsFor(tab: TabKey): TabKey[] {
  const related = new Set<TabKey>()
  for (const link of MODULE_CONNECTIONS) {
    if (link.tab === tab) link.needs.forEach((n) => related.add(n))
    if (link.needs.includes(tab)) related.add(link.tab)
  }
  related.delete(tab)
  return [...related]
}
