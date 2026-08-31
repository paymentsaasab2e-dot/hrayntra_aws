// Team Management Types

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum LoginOutcome {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  LOCKED = 'LOCKED',
}

export interface DepartmentRoleLink {
  id: string;
  departmentId: string;
  roleId: string;
  rank: number;
  role?: Role;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  allowsCrossDepartmentRequests?: boolean;
  createdAt: string;
  updatedAt: string;
  departmentRoles?: DepartmentRoleLink[];
}

/** Role assignment when creating or updating a department */
export interface DepartmentRoleInput {
  roleId?: string;
  roleName?: string;
  description?: string;
  color?: string;
  permissionIds?: string[];
  rank: number;
}

export interface Permission {
  id: string;
  permissionName: string;
  module: string;
  description?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  roleName: string;
  color: string;
  description?: string;
  createdAt: string;
}

export interface SystemRole extends Role {
  rolePermissions?: Array<{
    permission: Permission;
  }>;
  _count?: {
    users: number;
  };
  users?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
    status: UserStatus;
  }>;
}

export interface UserCredential {
  id: string;
  userId: string;
  loginId: string;
  tempPasswordFlag: boolean;
  inviteToken?: string;
  inviteSentAt?: string;
  inviteExpiresAt?: string;
  lastLoginAt?: string;
  failedAttempts: number;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginHistory {
  id: string;
  credentialId: string;
  ipAddress?: string;
  device?: string;
  outcome: LoginOutcome;
  timestamp: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  module: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface TeamTask {
  id: string;
  userId: string;
  taskTitle: string;
  description?: string;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamTarget {
  id: string;
  userId: string;
  targetType: string;
  targetValue: number;
  period: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  userId: string;
  placementId?: string;
  commissionAmount: number;
  commissionPct: number;
  status: CommissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  location?: string;
  status: UserStatus;
  role: Role;
  department: Department | null;
  /** Department authority rank (1 = head). From department role config. */
  departmentRank?: number | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  credential: {
    loginId: string;
    isLocked: boolean;
    lastLoginAt?: string | null;
    tempPasswordFlag: boolean;
  } | null;
  _count: {
    tasks: number;
    assignedLeads?: number;
  };
  credentialData?: {
    loginId: string;
    tempPassword: string;
  } | null;
  /** Company / branch this user belongs to (org structure). */
  orgUnitId?: string | null;
  orgUnit?: { id: string; name: string; kind: 'company' | 'branch' } | null;
  hierarchyPurpose?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberDetail extends TeamMember {
  systemRole?: SystemRole & {
    rolePermissions?: Array<{
      permission: Permission;
    }>;
  };
  departmentRelation?: Department;
  managerRelation?: { id: string; firstName: string; lastName: string };
  subordinates?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    designation?: string;
  }>;
  credential?: UserCredential & {
    loginHistory?: LoginHistory[];
  };
  activities?: UserActivity[];
  tasks?: TeamTask[];
  targets?: TeamTarget[];
  commissions?: Commission[];
}

// API Request/Response Types

export interface CreateMemberPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  location?: string;
  departmentId?: string;
  roleId?: string;
  managerId?: string;
  status?: UserStatus;
  generateCredentials?: boolean;
  sendInvite?: boolean;
  loginIdOption?: 'auto' | 'email' | 'custom';
  customLoginId?: string;
}

export interface UpdateMemberPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  location?: string;
  departmentId?: string;
  roleId?: string;
  managerId?: string;
  status?: UserStatus;
}

export interface GenerateCredentialsPayload {
  loginIdOption?: 'auto' | 'email' | 'custom';
  customLoginId?: string;
  sendInvite?: boolean;
}

export interface TeamMemberFilters {
  search?: string;
  departmentId?: string;
  roleName?: string;
  status?: UserStatus | 'all';
  managerId?: string;
  page?: number;
  limit?: number;
  orgUnitId?: string;
  companyId?: string;
}

export interface TeamMemberStats {
  totalMembers: number;
  activeMembers: number;
  roles: number;
  departments: number;
}

export type TeamRequestType = 'access' | 'leave' | 'support' | 'other';
export type TeamRequestPriority = 'low' | 'medium' | 'high';
export type TeamRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TeamRequest {
  id: string;
  requestType?: TeamRequestType;
  subject: string;
  description: string;
  priority: TeamRequestPriority;
  status: TeamRequestStatus;
  sendToId?: string;
  sendToName?: string;
  sendToEmail?: string;
  requestedById?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  linkedJobId?: string;
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamRequestPayload {
  sendToId: string;
  sendToName: string;
  sendToEmail?: string;
  subject: string;
  description: string;
  priority?: TeamRequestPriority;
}

export interface UpdateTeamRequestPayload {
  status: Extract<TeamRequestStatus, 'approved' | 'rejected' | 'cancelled'>;
  reviewNote?: string;
}

export interface TeamRequestJobPrefill {
  requestId: string;
  subject: string;
  description: string;
  priority?: TeamRequestPriority;
  requestedById?: string;
  requestedByName?: string;
}
