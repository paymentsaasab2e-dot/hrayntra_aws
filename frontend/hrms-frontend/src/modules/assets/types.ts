export type AssetType =
  | 'Laptop'
  | 'Monitor'
  | 'Keyboard & Mouse'
  | 'Headset'
  | 'Mobile Phone'
  | 'Access Card'
  | 'SIM Card'
  | 'Software License'
  | 'Other'

export type AssetStatus = 'Available' | 'Assigned' | 'In Repair' | 'Retired'

const ASSET_STATUSES: AssetStatus[] = ['Available', 'Assigned', 'In Repair', 'Retired']

/** Normalize API/legacy status strings to frontend AssetStatus. */
export function normalizeAssetStatus(status: string | undefined | null): AssetStatus {
  if (!status) return 'Available'
  if (status === 'Allocated') return 'Assigned'
  if (ASSET_STATUSES.includes(status as AssetStatus)) return status as AssetStatus
  return 'Available'
}

export type AssetCondition = 'New' | 'Good' | 'Fair' | 'Damaged'

export interface Asset {
  id: string
  name: string
  type: AssetType
  serialNumber: string
  brand: string
  model: string
  status: AssetStatus
  condition: AssetCondition
  purchasedOn: string // YYYY-MM-DD
  warrantyUntil?: string // YYYY-MM-DD
  notes?: string
}

export interface AssetAllocation {
  id: string
  assetId: string
  employeeId: string
  issuedOn: string     // YYYY-MM-DD
  expectedReturn?: string // YYYY-MM-DD
  returnedOn?: string  // YYYY-MM-DD
  conditionOnIssue: AssetCondition
  conditionOnReturn?: AssetCondition
  issuedBy: string     // employeeId of HR/Admin
  notes?: string
  status: 'Active' | 'Returned'
}
