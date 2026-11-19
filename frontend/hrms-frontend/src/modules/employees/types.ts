export type Employee = {
  id: string
  recordId?: string
  name: string
  firstName?: string
  lastName?: string
  email: string
  designation: string
  department: string
  status: "Active" | "Inactive" | "On Leave"
  manager: string
  avatarUrl?: string
  hasLogin?: boolean
  locationId?: string | null
  locationName?: string | null
  orgUnitId?: string | null
  orgUnitName?: string | null
  customFields?: Record<string, any>
}

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN' | 'TEXTAREA'

export type CustomFieldSection = 'PERSONAL' | 'WORK_DETAILS' | 'COMPLIANCE_KYC' | 'OTHER'

export interface CustomFieldDefinitionItem {
  id: string
  tenantId: string
  key: string
  label: string
  type: CustomFieldType
  section: CustomFieldSection
  options: string[]
  required: boolean
  placeholder?: string | null
  description?: string | null
  isActive: boolean
  order: number
  createdAt?: string
  updatedAt?: string
}

export type EmploymentChangeType =
  | 'INITIAL_HIRE'
  | 'PROMOTION'
  | 'TRANSFER'
  | 'REPORTING_CHANGE'
  | 'CONFIRMATION'
  | 'REVISION'

export interface EmploymentHistoryItem {
  id: string
  employeeId: string
  changeType: EmploymentChangeType
  effectiveDate: string
  endDate?: string | null
  designation: string
  department: string
  orgUnitId?: string | null
  orgUnitName?: string | null
  locationId?: string | null
  locationName?: string | null
  reportsToUserId?: string | null
  reportsToName?: string | null
  remarks?: string | null
  changeRequestId?: string | null
  recordedBy?: string | null
  createdAt?: string
}

export type ChangeRequestCategory =
  | 'PERSONAL_INFO'
  | 'JOB_ROLE'
  | 'BANK_DETAILS'
  | 'STATUTORY'
  | 'CUSTOM_FIELDS'
  | 'BENEFICIARIES'

export interface EmployeeChangeRequestItem {
  id: string
  employeeId: string
  requestedByUserId: string
  category: ChangeRequestCategory
  effectiveDate: string
  reason: string
  changes: Record<string, { oldValue: any; newValue: any }>
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedByUserId?: string | null
  reviewedAt?: string | null
  reviewRemark?: string | null
  createdAt: string
  employee?: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation: string
    department: string
  }
}

// ── Family, Dependents, Emergency Contacts & Nominees ──

export type FamilyRelationship =
  | 'SPOUSE'
  | 'FATHER'
  | 'MOTHER'
  | 'SON'
  | 'DAUGHTER'
  | 'BROTHER'
  | 'SISTER'
  | 'GUARDIAN'
  | 'OTHER'

export type NomineeBenefitScheme =
  | 'PF_EPF'
  | 'PF_EPS'
  | 'GRATUITY'
  | 'INSURANCE_GTLI'
  | 'INSURANCE_GPA'
  | 'GENERAL'

export type DependentGender = 'MALE' | 'FEMALE' | 'OTHER'

export interface EmployeeEmergencyContactItem {
  id: string
  tenantId: string
  employeeId: string
  name: string
  relationship: FamilyRelationship
  primaryPhone: string
  secondaryPhone?: string | null
  email?: string | null
  address?: string | null
  isPrimary: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EmployeeDependentItem {
  id: string
  tenantId: string
  employeeId: string
  fullName: string
  relationship: FamilyRelationship
  gender: DependentGender
  dateOfBirth: string
  isCoveredUnderGmc: boolean
  nationalIdNumber?: string | null
  preExistingDisease?: string | null
  isDisabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EmployeeNomineeItem {
  id: string
  tenantId: string
  employeeId: string
  name: string
  relationship: FamilyRelationship
  dateOfBirth: string
  scheme: NomineeBenefitScheme
  sharePercentage: number
  address?: string | null
  nationalIdNumber?: string | null
  isMinor: boolean
  guardianName?: string | null
  guardianRelation?: string | null
  guardianAge?: number | null
  guardianAddress?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface StatutorySchemeSummary {
  scheme: NomineeBenefitScheme
  schemeLabel: string
  totalAllocated: number
  status: 'COMPLIANT' | 'UNDER_ALLOCATED' | 'OVER_ALLOCATED'
  nomineeCount: number
  minorCount: number
  remainingPercentage: number
}

export interface BeneficiarySnapshot {
  employee: {
    id: string
    employeeId: string
    name: string
    email: string
    phone?: string | null
    designation: string
    department: string
    joiningDate: string
  }
  emergencyContacts: EmployeeEmergencyContactItem[]
  dependents: EmployeeDependentItem[]
  nominees: EmployeeNomineeItem[]
  statutorySummary: StatutorySchemeSummary[]
}

// ── Org Chart & Hierarchy ──

export interface OrgChartNode {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone?: string | null
  designation: string
  department: string
  locationName?: string | null
  orgUnitName?: string | null
  avatar?: string | null
  joiningDate: string
  dateOfBirth?: string | null
  status: string
  reportsToUserId?: string | null
  manager?: {
    id: string
    employeeId: string
    name: string
    designation: string
  } | null
  directReportsCount: number
  totalDescendantsCount: number
  depth: number
  children: OrgChartNode[]
}

export interface OrgChartResponse {
  roots: OrgChartNode[]
  totalEmployees: number
  rootCount: number
  maxDepth: number
  departments: string[]
}

// ── Birthdays, Anniversaries & Celebrations ──

export type CelebrationType = 'BIRTHDAY' | 'WORK_ANNIVERSARY' | 'NEW_JOINER'

export interface CelebrationItem {
  id: string
  type: CelebrationType
  employee: {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    name: string
    email: string
    designation: string
    department: string
    locationName?: string | null
    avatar?: string | null
  }
  date: string
  displayDate: string
  daysRemaining: number
  daysSinceJoining?: number
  isToday: boolean
  isThisWeek: boolean
  isThisMonth: boolean
  isMilestone?: boolean
  milestoneTitle: string
  tenureYears?: number
  turningAge?: number
  badge: string
}

export interface CelebrationsStats {
  birthdaysThisMonth: number
  anniversariesThisMonth: number
  newJoinersCount: number
  todayCount: number
  totalUpcoming: number
}

export interface CelebrationsResponse {
  stats: CelebrationsStats
  items: CelebrationItem[]
}

export interface CelebrationWish {
  id: string
  tenantId?: string
  senderUserId?: string
  senderName: string
  targetEmployeeId: string
  targetName: string
  type: string
  message: string
  createdAt: string
}



