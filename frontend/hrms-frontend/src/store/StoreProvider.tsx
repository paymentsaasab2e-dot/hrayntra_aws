"use client"
import * as React from 'react'
import { Task, Project } from '../modules/tasks/types'
import { mapProjectFromApi, mapTaskFromApi, priorityToApi, scheduleTypeToApi } from '../modules/tasks/taskMapper'
import { Employee } from '../modules/employees/types'
import { AttendanceRecord, RemoteRequest, AttendanceApprovalStatus } from '../modules/attendance/types'
import { LeaveRequest } from '../modules/leave/types'
import { PerformanceReview } from '../modules/performance/types'
import { Asset, AssetAllocation, AssetCondition, normalizeAssetStatus } from '../modules/assets/types'
import { Document, DocumentCategory } from '../modules/documents/types'
import { AppNotification } from '../modules/notifications/types'
import { api } from '../shared/api'
import { getCurrentPosition } from '../shared/geolocation'
import { notifyDataChanged, useDataSync } from '../shared/events'
import { PerformanceCycle } from '../modules/performance/types'
import {
  ActionKey,
  TabKey,
  UserPermissions,
  normalizePermissions,
} from '../shared/permissions'

export type UserRole = 'Employee' | 'Manager' | 'HR' | 'Superadmin' | 'PlatformOwner'

export const CURRENT_USER_ID = 'EMP-001'
const LATE_MARK_CUTOFF_MINUTES = 9 * 60 + 30
const getTodayDateString = () => new Date().toLocaleDateString('en-CA')
const AUTH_STORAGE_KEY = 'hrms_auth_session'

type AuthSession = {
  userId: string
  email: string
  role: UserRole
  backendRole: string
  name: string
  employeeId?: string
  permissions: UserPermissions
  showUsersLocationColumn?: boolean
  workLocation?: {
    id: string
    name: string
    lat: number
    lng: number
    radiusMeters: number
  } | null
}

function mapBackendRoleToUi(role: string): UserRole {
  if (role === 'PLATFORM_OWNER') return 'PlatformOwner'
  if (role === 'ADMIN') return 'Superadmin'
  if (role === 'HR') return 'HR'
  if (role === 'MANAGER') return 'Manager'
  return 'Employee'
}

function buildSessionFromApiUser(user: any): AuthSession {
  const backendRole = user.role || 'EMPLOYEE'
  const employeeCode = user.employee?.employeeId || user.employeeId || undefined
  return {
    userId: user.id,
    email: user.email,
    role: mapBackendRoleToUi(backendRole),
    backendRole,
    name: user.displayName || (user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user.email),
    employeeId: employeeCode,
    permissions: normalizePermissions(backendRole, user.permissions),
    showUsersLocationColumn: Boolean(user.showUsersLocationColumn),
    workLocation: user.employee?.location
      ? {
          id: user.employee.location.id,
          name: user.employee.location.name,
          lat: user.employee.location.lat,
          lng: user.employee.location.lng,
          radiusMeters: user.employee.location.radiusMeters,
        }
      : null,
  }
}

interface StoreContextValue {
  employees: Employee[]
  projects: Project[]
  tasks: Task[]
  attendanceRecords: AttendanceRecord[]
  remoteRequests: RemoteRequest[]
  leaveRequests: LeaveRequest[]
  performanceReviews: PerformanceReview[]
  assets: Asset[]
  assetAllocations: AssetAllocation[]
  documents: Document[]
  notifications: AppNotification[]
  currentUserRole: UserRole
  isAuthenticated: boolean
  sessionReady: boolean
  canImpersonateRoles: boolean
  currentUserName: string
  currentUserEmail: string
  workLocation: AuthSession['workLocation']
  showUsersLocationColumn: boolean
  permissions: UserPermissions
  hasTab: (tab: TabKey) => boolean
  hasAction: (action: ActionKey) => boolean
  activeEmployeeId: string
  holidays: any[]
  
  // Role Actions
  switchRole: (role: UserRole) => void
  login: (payload: { email: string; password: string }) => Promise<void>
  logout: () => void
  addEmployee: (employee: any) => Promise<void>
  updateEmployee: (employeeId: string, data: any) => Promise<void>
  deleteEmployee: (employeeId: string) => Promise<void>
  refreshEmployees: () => Promise<void>

  // Notification Actions
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  // Task Actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  refreshProjects: () => Promise<void>
  addProject: (data: { name: string; description?: string; projectHeadId?: string }) => Promise<void>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  
  // Attendance Actions
  checkIn: (mode: 'office' | 'remote', location?: string, employeeId?: string, opts?: { skipGeofence?: boolean }) => Promise<void>
  checkOut: (employeeId?: string) => Promise<void>
  updateAttendanceApproval: (id: string, status: AttendanceApprovalStatus, remark?: string) => void
  submitRemoteRequest: (request: any) => Promise<any> | void
  updateRequestStatus: (id: string, status: 'Approved' | 'Rejected', adminRemark?: string) => Promise<void> | void
  
  // Leave Actions
  applyForLeave: (request: Omit<LeaveRequest, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'employeeId'>) => void
  updateLeaveStatus: (id: string, status: 'Approved' | 'Rejected' | 'Modification Requested', remarks?: string) => void
  addHoliday: (data: { name: string; date: string; type?: string; description?: string }) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
  refreshHolidays: () => Promise<void>

  // Performance Actions
  submitSelfReview: (reviewId: string, rating: number, comments: string) => void
  submitManagerReview: (reviewId: string, rating: number, feedback: string) => void

  // Asset Actions
  addAsset: (asset: Omit<Asset, 'id'>) => void
  updateAsset: (id: string, updates: Partial<Omit<Asset, 'id'>>) => void
  deleteAsset: (id: string) => void
  assignAsset: (assetId: string, employeeId: string, opts: { conditionOnIssue: AssetCondition; expectedReturn?: string; notes?: string }) => void
  returnAsset: (allocationId: string, conditionOnReturn: AssetCondition, notes?: string) => void

  // Document Actions
  addDocument: (doc: Omit<Document, 'id' | 'uploadedAt' | 'uploadedBy' | 'status' | 'size' | 'url'>) => void
  archiveDocument: (id: string) => void
  addPerformanceReview: (data: { employeeId: string; cycle: string; cycleType: PerformanceCycle }) => void
  updatePerformanceReview: (id: string, updates: { managerScore?: number; comments?: string; status?: PerformanceReview['status'] }) => void
  refreshPerformanceReview: (id: string) => void
  deletePerformanceReview: (id: string) => void
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

export function useStore() {
  const context = React.useContext(StoreContext)
  if (!context) throw new Error("useStore must be used within StoreProvider")
  return context
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [attendanceRecords, setAttendanceRecords] = React.useState<AttendanceRecord[]>([])
  const [remoteRequests, setRemoteRequests] = React.useState<RemoteRequest[]>([])
  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([])
  const [performanceReviews, setPerformanceReviews] = React.useState<PerformanceReview[]>([])
  const [assets, setAssets] = React.useState<Asset[]>([])
  const [assetAllocations, setAssetAllocations] = React.useState<AssetAllocation[]>([])
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [holidays, setHolidays] = React.useState<any[]>([])
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const backendUnavailableLoggedRef = React.useRef(false)
  const notificationSeqRef = React.useRef(0)
  const escalatedTaskIdsRef = React.useRef(new Set<string>())
  const approachingDeadlineTaskIdsRef = React.useRef(new Set<string>())

  const [currentUserRole, setCurrentUserRole] = React.useState<UserRole>('HR')
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [authSession, setAuthSession] = React.useState<AuthSession | null>(null)
  const [sessionReady, setSessionReady] = React.useState(false)

  const applyAuthSession = React.useCallback((session: AuthSession) => {
    setAuthSession(session)
    setCurrentUserRole(session.role)
    setIsAuthenticated(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    async function restoreSession() {
      const token = localStorage.getItem('token')
      const rawSession = localStorage.getItem(AUTH_STORAGE_KEY)

      if (token) {
        try {
          const profile = await api.auth.me()
          if (profile?.user) {
            applyAuthSession(buildSessionFromApiUser(profile.user))
            setSessionReady(true)
            return
          }
        } catch {
          localStorage.removeItem('token')
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }

      if (rawSession && token) {
        try {
          const parsed = JSON.parse(rawSession) as AuthSession
          if (parsed.permissions) {
            applyAuthSession(parsed)
          }
        } catch {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      } else if (rawSession && !token) {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }

      setSessionReady(true)
    }

    restoreSession()
  }, [applyAuthSession])

  const permissions = authSession?.permissions || normalizePermissions('EMPLOYEE')

  const hasTab = React.useCallback(
    (tab: TabKey) => permissions.tabs[tab] === true,
    [permissions]
  )

  const hasAction = React.useCallback(
    (action: ActionKey) => permissions.actions[action] === true,
    [permissions]
  )

  const activeEmployeeId = React.useMemo(() => {
    if (authSession?.employeeId) return authSession.employeeId
    if (!employees.length) return CURRENT_USER_ID

    const roleMatcher = (employee: Employee, role: UserRole) => {
      const designation = (employee.designation || '').toLowerCase()
      const department = (employee.department || '').toLowerCase()
      if (role === 'HR') return designation.includes('hr') || department.includes('hr')
      if (role === 'Superadmin') return true
      if (role === 'Manager') return designation.includes('manager') || designation.includes('lead')
      return !(designation.includes('hr') || designation.includes('manager') || designation.includes('lead'))
    }

    return employees.find(employee => roleMatcher(employee, currentUserRole))?.id || employees[0].id
  }, [authSession?.employeeId, currentUserRole, employees])

  const normalizeLeaveStatus = React.useCallback((status: string | undefined): LeaveRequest['status'] => {
    const normalized = String(status || 'PENDING').toUpperCase()
    if (normalized === 'APPROVED') return 'Approved'
    if (normalized === 'REJECTED') return 'Rejected'
    return 'Pending'
  }, [])

  const normalizeLeaveType = React.useCallback((type: string | undefined): LeaveRequest['type'] => {
    const normalized = String(type || 'CASUAL').toUpperCase()
    if (normalized === 'SICK') return 'Sick'
    if (normalized === 'EARNED') return 'Earned'
    if (normalized === 'MATERNITY') return 'Maternity'
    if (normalized === 'PATERNITY') return 'Paternity'
    if (normalized === 'LOSS_OF_PAY') return 'Unpaid'
    return 'Casual'
  }, [])

  const toApiLeaveType = React.useCallback((type: LeaveRequest['type']) => {
    if (type === 'Sick') return 'SICK'
    if (type === 'Earned') return 'EARNED'
    if (type === 'Maternity') return 'MATERNITY'
    if (type === 'Paternity') return 'PATERNITY'
    if (type === 'Unpaid') return 'LOSS_OF_PAY'
    return 'CASUAL'
  }, [])

  const normalizeAttendanceStatus = React.useCallback((status: string): AttendanceRecord['status'] => {
    const normalized = status.toUpperCase()
    if (normalized === 'LATE') return 'Late'
    if (normalized === 'HALFDAY') return 'Half-day'
    if (normalized === 'ABSENT') return 'Absent'
    return 'Present'
  }, [])

  const mapEmployeeRecord = React.useCallback((employee: any): Employee => ({
    id: employee.employeeId,
    recordId: employee.id,
    name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || 'Unnamed',
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    email: employee.email,
    designation: employee.designation,
    department: employee.department,
    status: employee.status === 'ACTIVE' ? 'Active' : employee.status === 'ON_LEAVE' ? 'On Leave' : 'Inactive',
    manager: employee.manager || 'Unassigned',
    hasLogin: Boolean(employee.user?.email || employee.userId),
    locationId: employee.locationId || employee.location?.id || null,
    locationName: employee.location?.name || null,
    orgUnitId: employee.orgUnitId || employee.orgUnit?.id || null,
    orgUnitName: employee.orgUnit?.name || null,
    customFields: employee.customFields || {},
  }), [])

  const normalizeTaskStatus = React.useCallback((status: string | undefined): Task['status'] => {
    const normalized = String(status || 'TODO').toUpperCase()
    if (normalized === 'IN_PROGRESS') return 'in_progress'
    if (normalized === 'DONE' || normalized === 'COMPLETED') return 'completed'
    if (normalized === 'BLOCKED') return 'blocked'
    return 'todo'
  }, [])

  const normalizeTaskPriority = React.useCallback((priority: string | undefined): Task['priority'] => {
    const normalized = String(priority || 'medium').toLowerCase()
    if (normalized === 'less_urgent') return 'less_urgent'
    if (normalized === 'low') return 'low'
    if (normalized === 'high') return 'high'
    if (normalized === 'urgent') return 'urgent'
    return 'medium'
  }, [])

  const logLoadError = React.useCallback((label: string, err: unknown) => {
    if (err instanceof Error && err.message.startsWith('Unable to reach HRMS backend')) {
      if (!backendUnavailableLoggedRef.current) {
        console.warn(err.message)
        backendUnavailableLoggedRef.current = true
      }
      return
    }
    console.error(`Failed to load ${label}`, err)
  }, [])

  React.useEffect(() => {
    if (!sessionReady || !isAuthenticated) return

    let mounted = true

    async function loadData() {
      let mappedEmployees: Employee[] = []
      try {
        const empData = await api.employees.getAll()
        mappedEmployees = Array.isArray(empData) ? empData.map(mapEmployeeRecord) : []
        if (mounted) {
          setEmployees(mappedEmployees)
        }
      } catch (err) {
        logLoadError('employees', err)
      }

      try {
        const attData = await api.attendance.getHistory()
        if (mounted) {
          setAttendanceRecords(Array.isArray(attData?.data) ? attData.data.map((r: any) => ({
            id: r.id,
            employeeId: r.employee?.employeeId || r.employeeId,
            date: new Date(r.date).toLocaleDateString('en-CA'),
            checkIn: r.checkInTime,
            checkOut: r.checkOutTime,
            status: normalizeAttendanceStatus(r.status),
            mode: r.punchMode === 'remote' ? 'remote' : 'office',
            punchMode: r.punchMode || 'WEB',
            location: r.lat != null && r.lng != null ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}` : undefined,
            hospitalName: r.employee?.location?.name,
            lat: r.lat,
            lng: r.lng,
            distanceMeters: r.distanceMeters,
            punchStatus: r.punchStatus === 'REJECTED' ? 'Rejected' : 'Accepted',
            isActive: r.isActive === true,
            punchInPhotoUrl: r.punchInPhotoUrl || null,
            punchOutPhotoUrl: r.punchOutPhotoUrl || null,
            approvalRemark: r.rejectionReason || undefined,
          })) : [])
        }
      } catch (err) {
        logLoadError('attendance', err)
      }

      try {
        const leaveData = await api.leaves.getAll()
        if (mounted) {
          setLeaveRequests(Array.isArray(leaveData?.data) ? leaveData.data.map((l: any) => ({
            id: l.id,
            employeeId: l.employee?.employeeId || l.employeeId,
            type: normalizeLeaveType(l.type),
            startDate: l.startDate,
            endDate: l.endDate,
            totalDays: l.totalDays || 0,
            status: normalizeLeaveStatus(l.status),
            reason: l.reason,
            remarks: l.adminRemark,
            createdAt: l.appliedAt,
            updatedAt: l.updatedAt
          })) : [])
        }
      } catch (err) {
        logLoadError('leaves', err)
      }

      try {
        const holidayData = await api.holidays.getAll()
        if (mounted) {
          setHolidays(Array.isArray(holidayData?.data) ? holidayData.data : [])
        }
      } catch (err) {
        logLoadError('holidays', err)
      }

      try {
        const projectData = await api.projects.getAll()
        if (mounted) {
          setProjects(Array.isArray(projectData) ? projectData.map((p: any) => mapProjectFromApi(p, mappedEmployees)) : [])
        }
      } catch (err) {
        logLoadError('projects', err)
      }

      try {
        const taskData = await api.tasks.getAll()
        if (mounted) {
          setTasks(Array.isArray(taskData)
            ? taskData.map((t: any) => mapTaskFromApi(t, mappedEmployees))
            : [])
        }
      } catch (err) {
        logLoadError('tasks', err)
      }

      try {
        const assetData = await api.assets.getAll()
        if (mounted) {
          setAssets(Array.isArray(assetData?.data) ? assetData.data.map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            serialNumber: a.serialNumber,
            brand: a.brand,
            model: a.model,
            status: normalizeAssetStatus(a.status),
            condition: a.condition,
            purchasedOn: a.purchasedOn,
            warrantyUntil: a.warrantyUntil,
            notes: a.notes
          })) : [])
        }
      } catch (err) {
        logLoadError('assets', err)
      }

      try {
        const allocationData = await api.assets.getAllocations()
        if (mounted) {
          setAssetAllocations(Array.isArray(allocationData?.data) ? allocationData.data.map((a: any) => ({
            id: a.id,
            assetId: a.assetId,
            employeeId: a.employee?.employeeId || a.employeeId,
            issuedOn: a.issuedOn,
            expectedReturn: a.expectedReturn,
            returnedOn: a.returnedOn,
            conditionOnIssue: a.conditionOnIssue,
            conditionOnReturn: a.conditionOnReturn,
            issuedBy: a.issuedBy,
            notes: a.notes,
            status: a.status
          })) : [])
        }
      } catch (err) {
        logLoadError('asset allocations', err)
      }

      try {
        const docData = await api.documents.getAll()
        if (mounted) {
          setDocuments(Array.isArray(docData?.data) ? docData.data.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            category: d.category,
            employeeId: d.employee?.employeeId || d.employeeId,
            employeeName: d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : undefined,
            uploadedBy: d.uploadedBy,
            uploadedAt: d.uploadedAt,
            size: d.size,
            url: d.url,
            status: d.status,
            tags: d.tags
          })) : [])
        }
      } catch (err) {
        logLoadError('documents', err)
      }

      try {
        const perfData = await api.performance.getAll()
        if (mounted) {
          setPerformanceReviews(Array.isArray(perfData?.data) ? perfData.data.map((p: any) => ({
            id: p.id,
            employeeId: p.employee?.employeeId || p.employeeId,
            cycle: p.cycle,
            cycleType: p.cycleType,
            metrics: p.metrics,
            insights: p.insights,
            selfAssessment: p.selfAssessment,
            managerAssessment: p.managerAssessment,
            status: p.status
          })) : [])
        }
      } catch (err) {
        logLoadError('performance reviews', err)
      }

      if (mounted) {
        try {
          const reqRes = await api.attendance.getRequests()
          if (reqRes?.data && Array.isArray(reqRes.data)) {
            const mappedReqs: RemoteRequest[] = reqRes.data.map((r: any) => ({
              id: r.id,
              employeeId: r.employee?.employeeId || r.employeeId,
              date: r.startDate,
              startDate: r.startDate,
              endDate: r.endDate,
              purpose: r.reason,
              location: r.location || (r.type === 'WFH' ? 'Home Office' : 'Client Site'),
              status: r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : 'Pending',
              createdAt: r.appliedAt,
              type: r.type,
              inTime: r.inTime,
              outTime: r.outTime,
              adminRemark: r.adminRemark,
            }))
            setRemoteRequests(mappedReqs)
          } else {
            setRemoteRequests([])
          }
        } catch {
          setRemoteRequests([])
        }
        setNotifications([])
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [isAuthenticated, sessionReady, logLoadError, mapEmployeeRecord, normalizeAttendanceStatus, normalizeLeaveStatus, normalizeLeaveType, normalizeTaskPriority, normalizeTaskStatus])

  const switchRole = React.useCallback((role: UserRole) => {
    setCurrentUserRole(role)
    setAuthSession(prev => {
      if (!prev) return prev
      const next = { ...prev, role }
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const login = React.useCallback(async (payload: { email: string; password: string }) => {
    const result = await api.auth.login(payload.email, payload.password)
    if (!result?.token || !result?.user) {
      throw new Error('Login failed. Check email and password.')
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', result.token)
    }

    applyAuthSession(buildSessionFromApiUser(result.user))
  }, [applyAuthSession])

  const logout = React.useCallback(() => {
    setAuthSession(null)
    setIsAuthenticated(false)
    setCurrentUserRole('HR')
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem('token')
    }
  }, [])

  const addNotification = React.useCallback((
    type: AppNotification['type'],
    title: string,
    description: string,
    relatedPath?: string,
    options?: { id?: string; relatedId?: string }
  ) => {
    const notificationId = options?.id || `NT-${Date.now()}-${notificationSeqRef.current++}`
    setNotifications(prev => {
      if (prev.some(item => item.id === notificationId)) return prev
      return [
        {
          id: notificationId,
          type,
          title,
          description,
          relatedId: options?.relatedId,
          userId: CURRENT_USER_ID,
          isRead: false,
          createdAt: new Date().toISOString(),
          relatedPath
        },
        ...prev
      ]
    })
  }, [])

  React.useEffect(() => {
    const now = Date.now()
    tasks.forEach(task => {
      if (!task?.dueDate) return
      if (task.status === 'completed' || task.approvalStatus === 'Approved') {
        approachingDeadlineTaskIdsRef.current.delete(task.id)
        escalatedTaskIdsRef.current.delete(task.id)
        return
      }

      const dueTime = new Date(task.dueDate).getTime()
      if (Number.isNaN(dueTime)) return
      const remainingMs = dueTime - now

      if (remainingMs <= 24 * 60 * 60 * 1000 && remainingMs > 0 && !approachingDeadlineTaskIdsRef.current.has(task.id)) {
        approachingDeadlineTaskIdsRef.current.add(task.id)
        addNotification(
          'task',
          'Deadline Approaching',
          `${task.title} is due by ${new Date(task.dueDate).toLocaleString()}.`,
          '/tasks',
          { id: `task-approaching-${task.id}`, relatedId: task.id }
        )
      }

      if (remainingMs <= 0 && !escalatedTaskIdsRef.current.has(task.id)) {
        escalatedTaskIdsRef.current.add(task.id)
        addNotification(
          'task',
          'Task Escalated',
          `${task.title} is overdue and escalated for review.`,
          '/tasks',
          { id: `task-escalated-${task.id}`, relatedId: task.id }
        )
      }
    })
  }, [addNotification, tasks])

  const isLateMark = React.useCallback((checkInIso: string) => {
    const checkInDate = new Date(checkInIso)
    const totalMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes()
    return totalMinutes > LATE_MARK_CUTOFF_MINUTES
  }, [])

  const buildAttendanceRecord = React.useCallback((
    employeeId: string,
    mode: 'office' | 'remote',
    location: string | undefined,
    checkInSource: string,
    id: string,
  ): AttendanceRecord => {
    const lateMark = isLateMark(checkInSource)
    return {
      id,
      employeeId,
      date: getTodayDateString(),
      checkIn: checkInSource,
      checkOut: null,
      mode,
      status: lateMark ? 'Late' : 'Present',
      location,
      flags: lateMark ? ['late-mark', 'needs-approval'] : undefined,
      approvalStatus: lateMark ? 'Pending' : undefined,
      approvalRemark: lateMark ? 'Auto-flagged for late check-in approval.' : undefined
    }
  }, [isLateMark])

  const checkIn = React.useCallback(async (mode: 'office' | 'remote', location?: string, employeeId = CURRENT_USER_ID, opts?: { skipGeofence?: boolean }) => {
    const today = getTodayDateString()
    const existingOpenRecord = [...attendanceRecords]
      .filter(record => record.employeeId === employeeId && record.date === today && !record.checkOut)
      .sort((a, b) => new Date(b.checkIn || b.date).getTime() - new Date(a.checkIn || a.date).getTime())[0]

    if (existingOpenRecord) {
      addNotification('attendance', 'Attendance Already Open', `${employeeId} already has an active attendance session.`, '/attendance')
      return
    }

    const punchingForOther = employeeId !== activeEmployeeId
    const hrBypass = punchingForOther && permissions.actions.attendance_punch_hr
    const canRemoteSelf = permissions.actions.attendance_punch_remote_self
    const remoteAllowed = mode === 'remote' ? (punchingForOther ? hrBypass : canRemoteSelf) : false

    if (mode === 'remote' && !remoteAllowed) {
      addNotification(
        'attendance',
        'Remote Punch Not Allowed',
        'Your account is not allowed to punch remotely. Please enable Remote Punch in permissions or ask HR.',
        '/attendance'
      )
      throw new Error('Remote punch not allowed')
    }

    const skipGeofence = mode === 'remote' ? remoteAllowed : (opts?.skipGeofence === true || hrBypass)

    let coords: { lat: number; lng: number } | undefined
    try {
      // Always attempt GPS capture for both office + remote so we can audit distance to the geofence.
      coords = await getCurrentPosition()
    } catch (geoErr) {
      const message = geoErr instanceof Error ? geoErr.message : 'GPS unavailable'
      addNotification('attendance', 'Location Required', message, '/attendance')
      if (!punchingForOther) throw geoErr
    }

    try {
      const res = await api.attendance.checkIn({
        employeeId,
        lat: coords?.lat,
        lng: coords?.lng,
        skipGeofence,
        punchMode: mode,
        punchInTime: new Date().toISOString(),
      })
      const checkInSource = res?.data?.checkInTime || res?.data?.date || new Date().toISOString()
      const nextRecord = buildAttendanceRecord(
        employeeId,
        mode,
        location || (coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : undefined),
        checkInSource,
        res?.data?.id || `LOCAL-ATT-${Date.now()}`
      )
      setAttendanceRecords(prev => [nextRecord, ...prev])
      notifyDataChanged('attendance', { employeeId, action: 'CHECK_IN' })
      addNotification(
        'attendance',
        nextRecord.status === 'Late' ? 'Late Attendance Marked' : 'Attendance Marked',
        nextRecord.status === 'Late'
          ? `${employeeId} was marked late and is awaiting approval.`
          : `${employeeId} check-in was successful.`,
        '/attendance'
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-in failed'
      addNotification('attendance', 'Check-in Failed', message, '/attendance')
      throw err
    }
  }, [
    activeEmployeeId,
    addNotification,
    attendanceRecords,
    buildAttendanceRecord,
    permissions.actions.attendance_punch_hr,
    permissions.actions.attendance_punch_remote_self,
  ])

  const checkOut = React.useCallback(async (employeeId = CURRENT_USER_ID) => {
    const today = getTodayDateString()
    const record = [...attendanceRecords]
      .filter(r => r.date === today && r.employeeId === employeeId && !r.checkOut)
      .sort((a, b) => new Date(b.checkIn || b.date).getTime() - new Date(a.checkIn || a.date).getTime())[0]
    if (!record) return;

    const finalizeCheckOut = (checkOutTime: string) => {
      setAttendanceRecords(prev => prev.map(r => r.id === record.id ? { ...r, checkOut: checkOutTime } : r))
      addNotification('attendance', 'Checked Out', `${employeeId} check-out was recorded successfully.`, '/attendance')
    }

    try {
      if (record.id.startsWith('LOCAL-ATT-')) {
        finalizeCheckOut(new Date().toISOString())
        return
      }
      const punchMode = record.mode
      const punchingForOther = employeeId !== activeEmployeeId
      const hrBypass = punchingForOther && permissions.actions.attendance_punch_hr
      const canRemoteSelf = permissions.actions.attendance_punch_remote_self
      const remoteAllowed = punchMode === 'remote'
        ? (punchingForOther ? hrBypass : canRemoteSelf)
        : false

      let coords: { lat: number; lng: number } | undefined
      if (!punchingForOther) {
        coords = await getCurrentPosition()
      } else {
        try {
          coords = await getCurrentPosition()
        } catch {
          coords = undefined
        }
      }

      const skipGeofence = punchMode === 'remote' ? remoteAllowed : hrBypass

      const res = await api.attendance.checkOut(record.id, {
        lat: coords?.lat,
        lng: coords?.lng,
        skipGeofence,
        punchMode,
        punchOutTime: new Date().toISOString(),
      })
      const checkOutTime = res?.data?.checkOutTime || new Date().toISOString()
      finalizeCheckOut(checkOutTime)
      notifyDataChanged('attendance', { employeeId, action: 'CHECK_OUT' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check-out failed'
      addNotification('attendance', 'Check-out Failed', message, '/attendance')
      throw err
    }
  }, [
    activeEmployeeId,
    addNotification,
    attendanceRecords,
    permissions.actions.attendance_punch_hr,
    permissions.actions.attendance_punch_remote_self,
  ])

  const updateAttendanceApproval = React.useCallback((id: string, status: AttendanceApprovalStatus, remark?: string) => {
    const existingRecord = attendanceRecords.find(record => record.id === id)
    const finalRemark = remark?.trim() || (status === 'Approved'
      ? 'Late attendance approved by HR.'
      : 'Late attendance rejected by HR.')

    setAttendanceRecords(prev => prev.map(record => {
      if (record.id !== id) return record
      return {
        ...record,
        approvalStatus: status,
        approvalRemark: finalRemark,
        approvalUpdatedAt: new Date().toISOString(),
        flags: [
          ...(record.flags || []).filter(flag => flag !== 'needs-approval'),
          status === 'Approved' ? 'late-approved' : 'late-rejected',
        ],
      }
    }))

    if (existingRecord) {
      addNotification(
        'attendance',
        `Late Attendance ${status}`,
        `${existingRecord.employeeId} late attendance was ${status.toLowerCase()}.`,
        '/attendance'
      )
    }
  }, [addNotification, attendanceRecords])

  const applyForLeave = React.useCallback(async (requestData: any) => {
    try {
      const res = await api.leaves.apply({
        ...requestData,
        type: toApiLeaveType(requestData.type),
        employeeId: activeEmployeeId
      });
      setLeaveRequests(prev => [
        {
          ...res.data,
          employeeId: res.data.employee?.employeeId || activeEmployeeId,
          type: normalizeLeaveType(res.data.type),
          status: 'Pending',
          createdAt: res.data.appliedAt
        },
        ...prev
      ]);
      notifyDataChanged('leave', { employeeId: activeEmployeeId, action: 'APPLY' })
      notifyDataChanged('attendance', { employeeId: activeEmployeeId, action: 'APPLY' })
      addNotification('leave', 'Leave Application Submitted', `Applied for ${requestData.type} leave.`, '/leave');
    } catch (err) {
      console.error(err);
    }
  }, [activeEmployeeId, addNotification, normalizeLeaveType, toApiLeaveType])

  const updateLeaveStatus = React.useCallback(async (id: string, status: LeaveRequest['status'], remarks?: string) => {
    try {
      if (id && String(id).startsWith('req_')) {
        const mappedStatus = status === 'Approved' ? 'Approved' : 'Rejected'
        return await updateRequestStatus(id, mappedStatus, remarks)
      }

      const statusMap: Record<LeaveRequest['status'], string> = {
        Pending: 'PENDING',
        Approved: 'APPROVED',
        Rejected: 'REJECTED',
        Cancelled: 'REJECTED',
        'Modification Requested': 'MODIFICATION_REQUESTED'
      }

      const apiStatus = statusMap[status] || 'PENDING'
      await api.leaves.updateStatus(id, apiStatus, remarks)
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status, remarks } : r))
      notifyDataChanged('leave', { leaveId: id, status })
      notifyDataChanged('attendance', { leaveId: id, status })
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [])

  const addHoliday = React.useCallback(async (data: { name: string; date: string; type?: string; description?: string }) => {
    try {
      const res = await api.holidays.create(data)
      const holiday = res?.data || res
      setHolidays(prev => [holiday, ...prev])
      addNotification('system', 'Holiday Added', `${data.name} added to public holidays.`, '/time-off')
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [addNotification])

  const deleteHoliday = React.useCallback(async (id: string) => {
    try {
      await api.holidays.delete(id)
      setHolidays(prev => prev.filter((holiday: any) => holiday.id !== id))
      addNotification('system', 'Holiday Deleted', 'Public holiday removed successfully.', '/time-off')
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [addNotification])

  const refreshHolidays = React.useCallback(async () => {
    try {
      const holidayData = await api.holidays.getAll()
      setHolidays(Array.isArray(holidayData?.data) ? holidayData.data : [])
    } catch (err) {
      logLoadError('holidays', err)
    }
  }, [logLoadError])

  // Task Actions
  const addTask = React.useCallback(async (taskData: any) => {
    try {
      const assigneeIds = Array.isArray(taskData.assigneeIds)
        ? taskData.assigneeIds
        : taskData.assigneeId
          ? [taskData.assigneeId]
          : taskData.assignee?.id
            ? [taskData.assignee.id]
            : []

      const resolvedAssignees = assigneeIds
        .map((id: string) => employees.find(employee => employee.id === id || employee.recordId === id))
        .filter(Boolean)

      const primaryAssignee = resolvedAssignees[0]
      const backendAssigneeIds = assigneeIds.map((id: string) => {
        const emp = employees.find(employee => employee.id === id || employee.recordId === id)
        return emp?.recordId || emp?.id || id
      })

      if (backendAssigneeIds.length === 0 && currentUserRole !== 'Employee') {
        throw new Error('Please select at least one assignee before creating the task.')
      }

      const payload = {
        title: taskData.title,
        description: taskData.description || taskData.remarks,
        remarks: taskData.remarks || taskData.description,
        assignedTo: backendAssigneeIds[0],
        assigneeIds: backendAssigneeIds,
        projectId: taskData.projectId || null,
        projectHeadId: taskData.projectHeadId
          ? employees.find(employee => employee.id === taskData.projectHeadId)?.recordId || taskData.projectHeadId
          : null,
        priority: priorityToApi(taskData.priority || 'medium'),
        workDonePercent: taskData.workDonePercent ?? 0,
        extraDescriptions: taskData.extraDescriptions || [],
        reminderDates: taskData.reminderDates || [],
        reminderWeekdays: taskData.reminderWeekdays || [],
        scheduleType: scheduleTypeToApi(taskData.scheduleType || 'none'),
        scheduledDate: taskData.scheduledDate || null,
        scheduledWeekday: taskData.scheduledWeekday || null,
        dueDate: taskData.dueDate || null,
        isSelfTask: Boolean(taskData.isSelfTask),
      }

      const res = currentUserRole === 'Employee' || taskData.isSelfTask
        ? await api.tasks.createSelf(payload)
        : await api.tasks.create(payload)

      const mappedTask = mapTaskFromApi(res, employees)
      setTasks(prev => [mappedTask, ...prev])

      const assigneeLabel = mappedTask.assignees?.map(item => item.name).join(', ') || mappedTask.assignee.name
      addNotification(
        'task',
        'Task Created',
        taskData.isSelfTask
          ? `Self task "${taskData.title}" created.`
          : `Assigned task "${taskData.title}" to ${assigneeLabel}.`,
        '/tasks'
      )
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [addNotification, currentUserRole, employees])

  const updateTask = React.useCallback(async (id: string, updates: any) => {
    try {
      if (updates.status) {
        const normalizedStatus = String(updates.status).toLowerCase()
        const apiStatus =
          normalizedStatus === 'completed' ? 'DONE'
          : normalizedStatus === 'in_progress' || normalizedStatus === 'blocked' ? 'IN_PROGRESS'
          : 'TODO'
        const res = await api.tasks.updateStatus(id, apiStatus)
        const mappedTask = mapTaskFromApi(res, employees)
        setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates, ...mappedTask } : task))
        return
      }

      const payload: Record<string, unknown> = {}
      if (updates.title !== undefined) payload.title = updates.title
      if (updates.description !== undefined) payload.description = updates.description
      if (updates.remarks !== undefined) payload.remarks = updates.remarks
      if (updates.priority !== undefined) payload.priority = priorityToApi(updates.priority)
      if (updates.workDonePercent !== undefined) payload.workDonePercent = updates.workDonePercent
      if (updates.projectId !== undefined) payload.projectId = updates.projectId
      if (updates.scheduleType !== undefined) payload.scheduleType = scheduleTypeToApi(updates.scheduleType)
      if (updates.scheduledDate !== undefined) payload.scheduledDate = updates.scheduledDate
      if (updates.scheduledWeekday !== undefined) payload.scheduledWeekday = updates.scheduledWeekday
      if (updates.reminderDates !== undefined) payload.reminderDates = updates.reminderDates
      if (updates.reminderWeekdays !== undefined) payload.reminderWeekdays = updates.reminderWeekdays
      if (updates.extraDescriptions !== undefined) payload.extraDescriptions = updates.extraDescriptions
      if (updates.assigneeIds !== undefined || updates.projectHeadId !== undefined) {
        if (updates.assigneeIds !== undefined) {
          payload.assigneeIds = (updates.assigneeIds as string[]).map((assigneeId: string) => {
            const emp = employees.find(employee => employee.id === assigneeId || employee.recordId === assigneeId)
            return emp?.recordId || emp?.id || assigneeId
          })
          if ((payload.assigneeIds as string[]).length > 0) {
            payload.assignedTo = (payload.assigneeIds as string[])[0]
          }
        }
        if (updates.projectHeadId !== undefined) {
          payload.projectHeadId = updates.projectHeadId
            ? employees.find(employee => employee.id === updates.projectHeadId)?.recordId || updates.projectHeadId
            : null
        }
      }

      if (Object.keys(payload).length > 0) {
        const res = await api.tasks.update(id, payload)
        const mappedTask = mapTaskFromApi(res, employees)
        setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates, ...mappedTask } : task))
        return
      }

      setTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task))
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [employees])

  const deleteTask = React.useCallback(async (id: string) => {
    try {
      await api.tasks.delete(id)
      setTasks(prev => prev.filter(task => task.id !== id))
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [])

  const refreshProjects = React.useCallback(async () => {
    try {
      const projectData = await api.projects.getAll()
      setProjects(Array.isArray(projectData) ? projectData.map((p: any) => mapProjectFromApi(p, employees)) : [])
    } catch (err) {
      logLoadError('projects', err)
    }
  }, [employees, logLoadError])

  const addProject = React.useCallback(async (data: { name: string; description?: string; projectHeadId?: string }) => {
    const projectHeadId = data.projectHeadId
      ? employees.find(employee => employee.id === data.projectHeadId)?.recordId || data.projectHeadId
      : undefined
    const res = await api.projects.create({ ...data, projectHeadId })
    setProjects(prev => [mapProjectFromApi(res, employees), ...prev])
    addNotification('task', 'Project Created', `Project "${data.name}" is ready for tasks.`, '/tasks')
  }, [addNotification, employees])

  const updateProject = React.useCallback(async (id: string, data: Partial<Project>) => {
    const projectHeadId = data.projectHeadId
      ? employees.find(employee => employee.id === data.projectHeadId)?.recordId || data.projectHeadId
      : data.projectHeadId
    const res = await api.projects.update(id, { ...data, projectHeadId })
    setProjects(prev => prev.map(project => project.id === id ? mapProjectFromApi(res, employees) : project))
  }, [employees])

  const deleteProject = React.useCallback(async (id: string) => {
    await api.projects.delete(id)
    setProjects(prev => prev.filter(project => project.id !== id))
    setTasks(prev => prev.map(task => task.projectId === id ? { ...task, projectId: undefined, projectName: undefined } : task))
  }, [])

  // Remote / Attendance Requests (WFH, OD, Regularization, Short-Leave)
  const submitRemoteRequest = React.useCallback(async (requestData: {
    type?: 'WFH' | 'ON_DUTY' | 'REGULARIZATION' | 'SHORT_LEAVE'
    date?: string
    startDate?: string
    endDate?: string
    purpose?: string
    reason?: string
    location?: string
    inTime?: string
    outTime?: string
    shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY'
    shortLeaveHours?: number
    employeeId?: string
  }) => {
    const reqType = requestData.type || 'WFH'
    const sDate = requestData.startDate || requestData.date || new Date().toISOString().slice(0, 10)
    const eDate = requestData.endDate || sDate
    const rsn = requestData.reason || requestData.purpose || 'Work Request'
    const loc = requestData.location || (reqType === 'WFH' ? 'Home Office' : reqType === 'SHORT_LEAVE' ? 'Permission Pass' : 'Client Site')
    const empId = requestData.employeeId || activeEmployeeId || CURRENT_USER_ID

    let createdId = `REQ-${Date.now()}`
    try {
      const res = await api.attendance.submitRequest({
        type: reqType,
        startDate: sDate,
        endDate: eDate,
        reason: rsn,
        location: loc,
        inTime: requestData.inTime,
        outTime: requestData.outTime,
        shortLeaveType: requestData.shortLeaveType,
        shortLeaveHours: requestData.shortLeaveHours,
        employeeId: empId,
      })
      if (res?.data?.id) createdId = res.data.id
    } catch (e) {
      console.warn('Backend request submit fallback to local:', e)
    }

    const newReq: RemoteRequest = {
      id: createdId,
      employeeId: empId,
      date: sDate,
      startDate: sDate,
      endDate: eDate,
      purpose: rsn,
      location: loc,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      type: reqType,
      inTime: requestData.inTime,
      outTime: requestData.outTime,
      shortLeaveType: requestData.shortLeaveType,
      shortLeaveHours: requestData.shortLeaveHours,
    }

    setRemoteRequests(prev => [newReq, ...prev])
    addNotification(
      'attendance',
      `${reqType === 'WFH' ? 'Work From Home' : reqType === 'ON_DUTY' ? 'On-Duty' : reqType === 'SHORT_LEAVE' ? 'Short-Leave Permission' : 'Regularization'} Requested`,
      `Submitted request for ${sDate}${eDate !== sDate ? ` to ${eDate}` : ''}.`,
      '/attendance'
    )
    return newReq
  }, [activeEmployeeId, addNotification])

  const updateRequestStatus = React.useCallback(async (id: string, status: 'Approved' | 'Rejected', adminRemark?: string) => {
    try {
      await api.attendance.updateRequestStatus(id, {
        status: status === 'Approved' ? 'APPROVED' : 'REJECTED',
        adminRemark,
      })
    } catch (e) {
      console.warn('Backend updateRequestStatus error:', e)
    }

    setRemoteRequests(prev => prev.map(r => r.id === id ? { ...r, status, adminRemark } : r))

    if (status === 'Approved') {
      const target = remoteRequests.find(r => r.id === id)
      if (target) {
        const sDate = target.startDate || target.date
        const eDate = target.endDate || sDate
        const isWfh = target.type === 'WFH' || !target.type
        const isOd = target.type === 'ON_DUTY'
        const isReg = target.type === 'REGULARIZATION'
        const isShortLeave = target.type === 'SHORT_LEAVE'
        const defaultRemark = isWfh
          ? 'Approved Work From Home'
          : isOd
          ? 'Approved On-Duty'
          : isShortLeave
          ? `Approved Short-Leave (${target.shortLeaveType || 'Permission'} - ${target.shortLeaveHours || 2}h)`
          : 'Approved Regularization'

        const cur = new Date(sDate)
        const end = new Date(eDate)
        const datesToMark: string[] = []
        while (cur <= end) {
          datesToMark.push(cur.toISOString().slice(0, 10))
          cur.setDate(cur.getDate() + 1)
        }

        setAttendanceRecords(prev => {
          let updated = [...prev]
          datesToMark.forEach(dStr => {
            const existingIdx = updated.findIndex(r => r.employeeId === target.employeeId && r.date === dStr)
            if (existingIdx !== -1) {
              const rec = updated[existingIdx]
              updated[existingIdx] = {
                ...rec,
                status: 'Present',
                mode: isWfh ? 'remote' : rec.mode,
                punchStatus: 'Accepted',
                approvalStatus: 'Approved',
                approvalRemark: adminRemark || defaultRemark,
                flags: isWfh ? [...(rec.flags || []), 'wfh'] : isOd ? [...(rec.flags || []), 'on_duty'] : isShortLeave ? [...(rec.flags || []), 'short_leave'] : rec.flags,
                checkIn: rec.checkIn || (isReg && target.inTime ? `${dStr}T${target.inTime}:00.000Z` : `${dStr}T09:30:00.000Z`),
                checkOut: rec.checkOut || (isReg && target.outTime ? `${dStr}T${target.outTime}:00.000Z` : `${dStr}T18:30:00.000Z`),
              }
            } else {
              updated.unshift({
                id: `att-gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                employeeId: target.employeeId,
                date: dStr,
                checkIn: isReg && target.inTime ? `${dStr}T${target.inTime}:00.000Z` : `${dStr}T09:30:00.000Z`,
                checkOut: isReg && target.outTime ? `${dStr}T${target.outTime}:00.000Z` : `${dStr}T18:30:00.000Z`,
                mode: isWfh ? 'remote' : 'office',
                status: 'Present',
                location: isWfh ? 'Work From Home (Approved)' : isOd ? 'On-Duty (Approved)' : isShortLeave ? 'Office (Short Leave Pass)' : 'Regularized Office',
                punchStatus: 'Accepted',
                isActive: false,
                flags: isWfh ? ['wfh'] : isOd ? ['on_duty'] : isShortLeave ? ['short_leave'] : ['regularized'],
                approvalStatus: 'Approved',
                approvalRemark: adminRemark || defaultRemark,
              })
            }
          })
          return updated
        })
      }
    }
    notifyDataChanged('attendance', { requestId: id, status })
    notifyDataChanged('leave', { requestId: id, status })
  }, [remoteRequests])

  const mapPerformanceReview = React.useCallback((review: any): PerformanceReview => ({
    id: review.id,
    employeeId: review.employee?.employeeId || review.employeeId,
    cycle: review.cycle,
    cycleType: review.cycleType,
    metrics: review.metrics,
    insights: review.insights,
    selfAssessment: review.selfAssessment,
    managerAssessment: review.managerAssessment,
    status: review.status,
  }), [])

  // Performance Assessment Actions
  const submitSelfReview = React.useCallback(async (reviewId: string, rating: number, comments: string) => {
    try {
      await api.performance.submitSelfReview(reviewId, { rating, comments });
      setPerformanceReviews(prev => prev.map(r => r.id === reviewId ? {
        ...r,
        selfAssessment: {
          submittedAt: new Date().toISOString(),
          rating,
          comments
        },
        status: 'Pending Manager Review'
      } : r));
      addNotification('performance', 'Self Review Submitted', 'Your self assessment was submitted successfully.', '/performance');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  const submitManagerReview = React.useCallback(async (reviewId: string, rating: number, feedback: string) => {
    try {
      const res = await api.performance.submitManagerReview(reviewId, { rating, feedback });
      const review = res?.data || res;
      setPerformanceReviews(prev => prev.map(r => r.id === reviewId ? mapPerformanceReview(review) : r));
      addNotification('performance', 'Manager Review Submitted', 'Team member performance assessment completed.', '/performance');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification, mapPerformanceReview])

  // Asset Actions
  const addAsset = React.useCallback(async (assetData: any) => {
    try {
      const res = await api.assets.create(assetData);
      setAssets(prev => [
        {
          id: res.data.id,
          name: res.data.name,
          type: res.data.type,
          serialNumber: res.data.serialNumber,
          brand: res.data.brand,
          model: res.data.model,
          status: res.data.status,
          condition: res.data.condition,
          purchasedOn: res.data.purchasedOn,
          warrantyUntil: res.data.warrantyUntil,
          notes: res.data.notes
        },
        ...prev
      ]);
      addNotification('system', 'New Asset Added', `Successfully added asset: ${assetData.name}.`, '/assets');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  const updateAsset = React.useCallback(async (id: string, updates: Partial<Omit<Asset, 'id'>>) => {
    try {
      const res = await api.assets.update(id, updates)
      const nextAsset = res?.data || res
      setAssets(prev => prev.map(asset => asset.id === id ? { ...asset, ...nextAsset } : asset))
      addNotification('system', 'Asset Updated', `Updated asset ${id}.`, '/assets')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification])

  const deleteAsset = React.useCallback(async (id: string) => {
    try {
      await api.assets.delete(id)
      setAssets(prev => prev.filter(asset => asset.id !== id))
      setAssetAllocations(prev => prev.filter(allocation => allocation.assetId !== id))
      addNotification('system', 'Asset Deleted', `Deleted asset ${id}.`, '/assets')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification])

  const assignAsset = React.useCallback(async (assetId: string, employeeId: string, opts: any) => {
    try {
      const res = await api.assets.assign({
        assetId,
        employeeId,
        issuedOn: new Date().toISOString().split('T')[0],
        expectedReturn: opts.expectedReturn,
        conditionOnIssue: opts.conditionOnIssue,
        notes: opts.notes
      });
      setAssetAllocations(prev => [
        {
          id: res.data.id,
          assetId,
          employeeId,
          issuedOn: res.data.issuedOn,
          expectedReturn: res.data.expectedReturn,
          conditionOnIssue: res.data.conditionOnIssue,
          issuedBy: res.data.issuedBy,
          notes: res.data.notes,
          status: 'Active'
        },
        ...prev
      ]);
      setAssets(prev => prev.map(a => a.id === assetId ? { ...a, status: 'Assigned' } : a));
      addNotification('system', 'Asset Assigned', `Asset assigned successfully to employee.`, '/assets');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  const returnAsset = React.useCallback(async (allocationId: string, conditionOnReturn: any, notes?: string) => {
    try {
      const res = await api.assets.return(allocationId, {
        returnedOn: new Date().toISOString().split('T')[0],
        conditionOnReturn,
        notes
      });
      setAssetAllocations(prev => prev.map(a => a.id === allocationId ? {
        ...a,
        returnedOn: res.data.returnedOn,
        conditionOnReturn,
        notes,
        status: 'Returned'
      } : a));
      setAssets(prev => prev.map(a => a.id === res.data.assetId ? { ...a, status: 'Available' } : a));
      addNotification('system', 'Asset Returned', 'Asset allocation marked as returned successfully.', '/assets');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  // Document Actions
  const addDocument = React.useCallback(async (docData: any) => {
    try {
      const res = await api.documents.create(docData);
      setDocuments(prev => [
        {
          id: res.data.id,
          name: res.data.name,
          type: res.data.type,
          category: res.data.category,
          employeeId: res.data.employeeId,
          uploadedBy: res.data.uploadedBy,
          uploadedAt: res.data.uploadedAt,
          size: res.data.size,
          url: res.data.url,
          status: 'Active',
          tags: res.data.tags
        },
        ...prev
      ]);
      addNotification('system', 'Document Uploaded', `Successfully uploaded document: ${docData.name}.`, '/documents');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  const archiveDocument = React.useCallback(async (id: string) => {
    try {
      await api.documents.archive(id);
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'Archived' } : d));
      addNotification('system', 'Document Archived', 'Document has been archived.', '/documents');
    } catch (err) {
      console.error(err);
    }
  }, [addNotification])

  const addPerformanceReview = React.useCallback(async (data: { employeeId: string; cycle: string; cycleType: PerformanceCycle }) => {
    try {
      const res = await api.performance.create({
        employeeId: data.employeeId,
        cycle: data.cycle,
        cycleType: data.cycleType,
      })
      const review = res?.data || res
      setPerformanceReviews(prev => [mapPerformanceReview(review), ...prev])
      addNotification('performance', 'Performance Review Added', `Auto-scored review created for ${data.employeeId}.`, '/performance')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification, mapPerformanceReview])

  const updatePerformanceReview = React.useCallback(async (id: string, updates: { managerScore?: number; comments?: string; status?: PerformanceReview['status'] }) => {
    try {
      if (updates.managerScore !== undefined) {
        const res = await api.performance.submitManagerReview(id, {
          rating: Math.max(1, Math.min(5, updates.managerScore)),
          feedback: updates.comments || '',
        })
        const review = res?.data || res
        setPerformanceReviews(prev => prev.map(item => item.id !== id ? item : mapPerformanceReview(review)))
      } else {
        const res = await api.performance.update(id, { status: updates.status })
        const review = res?.data || res
        setPerformanceReviews(prev => prev.map(item => item.id !== id ? item : mapPerformanceReview(review)))
      }
      addNotification('performance', 'Performance Review Updated', `Updated review ${id}.`, '/performance')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification, mapPerformanceReview])

  const refreshPerformanceReview = React.useCallback(async (id: string) => {
    try {
      const res = await api.performance.refresh(id)
      const review = res?.data || res
      setPerformanceReviews(prev => prev.map(item => item.id !== id ? item : mapPerformanceReview(review)))
      addNotification('performance', 'Scores Refreshed', 'Performance metrics recalculated from live data.', '/performance')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification, mapPerformanceReview])

  const deletePerformanceReview = React.useCallback(async (id: string) => {
    try {
      await api.performance.delete(id)
      setPerformanceReviews(prev => prev.filter(review => review.id !== id))
      addNotification('performance', 'Performance Review Deleted', `Deleted review ${id}.`, '/performance')
    } catch (err) {
      console.error(err)
    }
  }, [addNotification])

  const refreshEmployees = React.useCallback(async () => {
    try {
      const empData = await api.employees.getAll();
      setEmployees(Array.isArray(empData) ? empData.map(mapEmployeeRecord) : []);
    } catch (err) {
      logLoadError('employees', err);
    }
  }, [logLoadError, mapEmployeeRecord]);

  const addEmployee = React.useCallback(async (empData: any) => {
    try {
      const res = await api.employees.create(empData);
      setEmployees(prev => [
        {
          ...mapEmployeeRecord(res),
        },
        ...prev
      ]);
      addNotification('system', 'New Employee Added', `Added ${res.firstName} ${res.lastName}. Create login in Users tab to send password email.`, '/users');
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [addNotification, mapEmployeeRecord])

  const updateEmployee = React.useCallback(async (employeeId: string, empData: any) => {
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee?.recordId) {
      throw new Error('Employee record id not found for update')
    }
    try {
      const res = await api.employees.update(employee.recordId, empData)
      const mapped = mapEmployeeRecord(res)
      setEmployees((prev) => prev.map((item) => (item.id === employeeId || item.recordId === employee.recordId ? { ...item, ...mapped, id: mapped.id || item.id } : item)))
      addNotification('system', 'Employee Updated', `Updated ${mapped.name || employee.name}.`, `/employees/${mapped.id || employeeId}`)
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [addNotification, employees, mapEmployeeRecord])

  const deleteEmployee = React.useCallback(async (employeeId: string) => {
    const employee = employees.find(item => item.id === employeeId)
    if (!employee?.recordId) {
      throw new Error('Employee record id not found for deletion')
    }

    try {
      await api.employees.delete(employee.recordId)
      setEmployees(prev => prev.filter(item => item.id !== employeeId))
      setTasks(prev => prev.filter(task => task.assignee.id !== employeeId))
      setAttendanceRecords(prev => prev.filter(record => record.employeeId !== employeeId))
      setLeaveRequests(prev => prev.filter(request => request.employeeId !== employeeId))
      setPerformanceReviews(prev => prev.filter(review => review.employeeId !== employeeId))
      setAssetAllocations(prev => prev.filter(allocation => allocation.employeeId !== employeeId))
      setDocuments(prev => prev.filter(document => document.employeeId !== employeeId))
      addNotification('system', 'Employee Deleted', `Deleted employee ${employee.name}.`, '/employees')
    } catch (err) {
      console.error(err)
      throw err
    }
  }, [addNotification, employees])

  const markAsRead = React.useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }, [])

  const markAllAsRead = React.useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }, [])

  return (
    <StoreContext.Provider value={{ 
      employees, projects, tasks, attendanceRecords, remoteRequests, leaveRequests, performanceReviews,
      assets, assetAllocations, documents, holidays,
      addTask, updateTask, deleteTask, refreshProjects, addProject, updateProject, deleteProject,
      checkIn, checkOut, updateAttendanceApproval, submitRemoteRequest, updateRequestStatus,
      applyForLeave, updateLeaveStatus, addHoliday, deleteHoliday, refreshHolidays,
      submitSelfReview, submitManagerReview,
      addAsset, updateAsset, deleteAsset, assignAsset, returnAsset,
      addDocument, archiveDocument,
      addPerformanceReview, updatePerformanceReview, refreshPerformanceReview, deletePerformanceReview,
      notifications, markAsRead, markAllAsRead,
      currentUserRole, isAuthenticated, sessionReady,
      canImpersonateRoles: authSession?.backendRole === 'ADMIN',
      currentUserName: authSession?.name || 'User',
      currentUserEmail: authSession?.email || '',
      workLocation: authSession?.workLocation || null,
      showUsersLocationColumn: Boolean(authSession?.showUsersLocationColumn),
      permissions, hasTab, hasAction,
      activeEmployeeId, switchRole, login, logout, addEmployee, updateEmployee, deleteEmployee, refreshEmployees
    }}>
      {children}
    </StoreContext.Provider>
  )
}
