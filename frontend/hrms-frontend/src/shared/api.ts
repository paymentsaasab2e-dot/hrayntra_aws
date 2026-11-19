const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Unable to reach HRMS backend at ${API_BASE_URL}.`);
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token && typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export const api = {
  // ── Auth ──
  auth: {
    login: (email: string, password: string) =>
      apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => apiFetch('/auth/profile'),
  },

  users: {
    getAll: () => apiFetch('/users'),
    create: (data: any) => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/users/${id}`, { method: 'DELETE' }),
  },

  // ── Employees ──
  employees: {
    getAll: () => apiFetch('/employees'),
    getById: (id: string) => apiFetch(`/employees/${id}`),
    create: (data: any) => apiFetch('/employees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/employees/${id}`, { method: 'DELETE' }),

    // Change Requests
    getChangeRequests: (params?: { employeeId?: string; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.status) q.set('status', params.status)
      const qs = q.toString()
      if (params?.employeeId) {
        return apiFetch(`/employees/${params.employeeId}/change-requests${qs ? `?${qs}` : ''}`)
      }
      return apiFetch(`/employees/change-requests${qs ? `?${qs}` : ''}`)
    },
    getChangeRequestById: (requestId: string) => apiFetch(`/employees/change-requests/${requestId}`),
    submitChangeRequest: (employeeId: string, data: any) =>
      apiFetch(`/employees/${employeeId}/change-requests`, { method: 'POST', body: JSON.stringify(data) }),
    updateChangeRequestStatus: (requestId: string, data: { status: 'APPROVED' | 'REJECTED'; reviewRemark?: string }) =>
      apiFetch(`/employees/change-requests/${requestId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

    // Employment History with Effective Dates
    getHistory: (employeeId: string) => apiFetch(`/employees/${employeeId}/history`),
    addHistoryMilestone: (employeeId: string, data: any) =>
      apiFetch(`/employees/${employeeId}/history`, { method: 'POST', body: JSON.stringify(data) }),
    deleteHistoryMilestone: (employeeId: string, historyId: string) =>
      apiFetch(`/employees/${employeeId}/history/${historyId}`, { method: 'DELETE' }),

    // Family Dependents, Emergency Contacts & Statutory Nominees (PF/Gratuity/Insurance)
    beneficiaries: {
      getSnapshot: (employeeId: string) => apiFetch(`/employees/${employeeId}/beneficiaries`),
      listEmergencyContacts: (employeeId: string) => apiFetch(`/employees/${employeeId}/beneficiaries/emergency-contacts`),
      addEmergencyContact: (employeeId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/emergency-contacts`, { method: 'POST', body: JSON.stringify(data) }),
      updateEmergencyContact: (employeeId: string, contactId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/emergency-contacts/${contactId}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteEmergencyContact: (employeeId: string, contactId: string) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/emergency-contacts/${contactId}`, { method: 'DELETE' }),

      listDependents: (employeeId: string) => apiFetch(`/employees/${employeeId}/beneficiaries/dependents`),
      addDependent: (employeeId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/dependents`, { method: 'POST', body: JSON.stringify(data) }),
      updateDependent: (employeeId: string, dependentId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/dependents/${dependentId}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteDependent: (employeeId: string, dependentId: string) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/dependents/${dependentId}`, { method: 'DELETE' }),

      listNominees: (employeeId: string, scheme?: string) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/nominees${scheme ? `?scheme=${scheme}` : ''}`),
      addNominee: (employeeId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/nominees`, { method: 'POST', body: JSON.stringify(data) }),
      updateNominee: (employeeId: string, nomineeId: string, data: any) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/nominees/${nomineeId}`, { method: 'PUT', body: JSON.stringify(data) }),
      deleteNominee: (employeeId: string, nomineeId: string) =>
        apiFetch(`/employees/${employeeId}/beneficiaries/nominees/${nomineeId}`, { method: 'DELETE' }),
    },

    // Org Chart & Reporting Tree
    getOrgChartTree: (params?: { rootEmployeeId?: string }) => {
      const q = new URLSearchParams()
      if (params?.rootEmployeeId) q.set('rootEmployeeId', params.rootEmployeeId)
      const qs = q.toString()
      return apiFetch(`/employees/org-chart/tree${qs ? `?${qs}` : ''}`)
    },

    // Birthdays, Anniversaries & Celebrations Directory
    getCelebrations: (params?: { month?: number; timeframe?: 'all' | 'today' | 'week' | 'month'; type?: string }) => {
      const q = new URLSearchParams()
      if (params?.month !== undefined) q.set('month', String(params.month))
      if (params?.timeframe) q.set('timeframe', params.timeframe)
      if (params?.type) q.set('type', params.type)
      const qs = q.toString()
      return apiFetch(`/employees/celebrations${qs ? `?${qs}` : ''}`)
    },
    sendCelebrationWish: (data: { targetEmployeeId: string; type: string; message: string; greetingType?: string }) =>
      apiFetch('/employees/celebrations/send-wishes', { method: 'POST', body: JSON.stringify(data) }),
    getCelebrationWishes: (employeeId?: string) =>
      apiFetch(`/employees/celebrations/wishes${employeeId ? `?employeeId=${employeeId}` : ''}`),
  },

  locations: {
    getAll: (activeOnly?: boolean) =>
      apiFetch(`/locations${activeOnly ? '?activeOnly=true' : ''}`),
    getById: (id: string) => apiFetch(`/locations/${id}`),
    create: (data: any) => apiFetch('/locations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/locations/${id}`, { method: 'DELETE' }),
  },

  fieldVisits: {
    listLocations: (activeOnly?: boolean) =>
      apiFetch(`/field-visits/locations${activeOnly ? '?activeOnly=true' : ''}`),
    listRoster: (date: string, employeeId?: string) => {
      const q = new URLSearchParams({ date })
      if (employeeId) q.set('employeeId', employeeId)
      return apiFetch(`/field-visits/roster?${q}`)
    },
    assignRoster: (data: { dateKey: string; employeeId: string; locationIds: string[]; plannedTimes?: string[] }) =>
      apiFetch('/field-visits/roster', { method: 'POST', body: JSON.stringify(data) }),
    removeAssignment: (id: string) => apiFetch(`/field-visits/roster/${id}`, { method: 'DELETE' }),
    verifyVisit: (id: string, lat: number, lng: number, hrOverride?: boolean) =>
      apiFetch(`/field-visits/roster/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ lat, lng, hrOverride }),
      }),
    markMissed: (id: string) => apiFetch(`/field-visits/roster/${id}/missed`, { method: 'POST' }),
    getMineToday: () => apiFetch('/field-visits/mine/today'),
    recordPing: (lat: number, lng: number) =>
      apiFetch('/field-visits/ping', { method: 'POST', body: JSON.stringify({ lat, lng }) }),
    getLive: (date?: string) =>
      apiFetch(`/field-visits/live${date ? `?date=${date}` : ''}`),
  },

  orgUnits: {
    getTree: () => apiFetch('/org-units'),
    getById: (id: string) => apiFetch(`/org-units/${id}`),
    create: (data: { parentId: string; name: string; isLeaf: boolean }) =>
      apiFetch('/org-units', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string }) =>
      apiFetch(`/org-units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/org-units/${id}`, { method: 'DELETE' }),
    approve: (id: string) => apiFetch(`/org-units/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => apiFetch(`/org-units/${id}/reject`, { method: 'POST' }),
  },

  approvals: {
    getInbox: () => apiFetch('/approvals/inbox'),
    act: (id: string, action: 'approve' | 'reject', remark?: string, approvedLWD?: string) =>
      apiFetch(`/approvals/${id}/act`, { method: 'POST', body: JSON.stringify({ action, remark, approvedLWD }) }),
    delegations: {
      list: (params?: { myOnly?: boolean }) =>
        apiFetch(`/approvals/delegations${params?.myOnly ? '?myOnly=true' : ''}`),
      create: (data: {
        delegateeUserId: string
        startDate: string
        endDate: string
        scope?: 'ALL' | 'LEAVE' | 'ATTENDANCE' | 'EXIT'
        reason?: string
      }) => apiFetch('/approvals/delegations', { method: 'POST', body: JSON.stringify(data) }),
      revoke: (id: string) =>
        apiFetch(`/approvals/delegations/${id}`, { method: 'DELETE' }),
    },
  },

  policies: {
    getActive: () => apiFetch('/policies/active'),
    updateActive: (rules: Record<string, unknown>) =>
      apiFetch('/policies/active', { method: 'PATCH', body: JSON.stringify({ rules }) }),
    list: () => apiFetch('/policies'),
    getById: (id: string) => apiFetch(`/policies/${id}`),
    createManual: (title: string) =>
      apiFetch('/policies', { method: 'POST', body: JSON.stringify({ title }) }),
    updateRules: (id: string, rules: Record<string, unknown>) =>
      apiFetch(`/policies/${id}/rules`, { method: 'PATCH', body: JSON.stringify({ rules }) }),
    publish: (id: string) => apiFetch(`/policies/${id}/publish`, { method: 'POST' }),
    acknowledge: (versionId: string) =>
      apiFetch(`/policies/versions/${versionId}/acknowledge`, { method: 'POST' }),
    upload: async (title: string, file: File) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const form = new FormData()
      form.append('title', title)
      form.append('file', file)
      const response = await fetch(`${API_BASE_URL}/policies/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Upload failed')
      return data
    },
  },

  separation: {
    getPolicy: () => apiFetch('/separation/policy'),
    getMine: () => apiFetch('/separation/mine'),
    list: () => apiFetch('/separation'),
    getById: (id: string) => apiFetch(`/separation/${id}`),
    submit: (data: { reason: string; requestedLWD: string; submit?: boolean }) =>
      apiFetch('/separation', { method: 'POST', body: JSON.stringify(data) }),
    withdraw: (id: string) => apiFetch(`/separation/${id}/withdraw`, { method: 'POST' }),
    updateChecklist: (id: string, items: { label: string; done: boolean }[]) =>
      apiFetch(`/separation/${id}/checklist`, { method: 'PATCH', body: JSON.stringify({ items }) }),
    complete: (id: string) => apiFetch(`/separation/${id}/complete`, { method: 'POST' }),
  },

  platform: {
    listPackages: () => apiFetch('/platform/packages'),
    getStats: (params?: { minUsers?: number; maxUsers?: number; packageKey?: string; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.minUsers !== undefined) q.set('minUsers', String(params.minUsers))
      if (params?.maxUsers !== undefined) q.set('maxUsers', String(params.maxUsers))
      if (params?.packageKey) q.set('packageKey', params.packageKey)
      if (params?.status) q.set('status', params.status)
      const qs = q.toString()
      return apiFetch(`/platform/stats${qs ? `?${qs}` : ''}`)
    },
    listTenants: () => apiFetch('/platform/tenants'),
    getTenant: (id: string) => apiFetch(`/platform/tenants/${id}`),
    getTenantCredentials: (id: string) => apiFetch(`/platform/tenants/${id}/credentials`),
    createTenant: (data: {
      name: string
      slug?: string
      rootOrgName?: string
      levels?: { levelOrder: number; code: string; displayName: string; isLeaf: boolean }[]
      packageKey?: string
      maxUsers?: number
      customPermissions?: { tabs: Record<string, boolean>; actions: Record<string, boolean> }
      tenantAdmin: { email: string; password: string; displayName: string }
    }) => apiFetch('/platform/tenants', { method: 'POST', body: JSON.stringify(data) }),
    updateTenant: (id: string, data: {
      name?: string
      slug?: string
      status?: string
      rootOrgName?: string
      showUsersLocationColumn?: boolean
    }) =>
      apiFetch(`/platform/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateTenantAdmin: (id: string, data: { displayName?: string; email?: string; password?: string }) =>
      apiFetch(`/platform/tenants/${id}/admin`, { method: 'PATCH', body: JSON.stringify(data) }),
    updateTenantPackage: (id: string, data: {
      packageKey: string
      maxUsers?: number
      customPermissions?: { tabs: Record<string, boolean>; actions: Record<string, boolean> }
    }) =>
      apiFetch(`/platform/tenants/${id}/package`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteTenant: (id: string) => apiFetch(`/platform/tenants/${id}`, { method: 'DELETE' }),
  },

  // ── Attendance ──
  attendance: {
    checkIn: (data: {
      employeeId?: string
      lat?: number
      lng?: number
      latitude?: number
      longitude?: number
      accuracy?: number
      ipAddress?: string
      deviceInfo?: string
      browser?: string
      skipGeofence?: boolean
      punchMode?: string
      punchInTime?: string
    }) => apiFetch('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),
    checkOut: (
      id: string,
      data?: {
        lat?: number
        lng?: number
        latitude?: number
        longitude?: number
        accuracy?: number
        ipAddress?: string
        deviceInfo?: string
        browser?: string
        skipGeofence?: boolean
        punchMode?: string
        punchOutTime?: string
      }
    ) => apiFetch(`/attendance/check-out/${id}`, { method: 'POST', body: JSON.stringify(data || {}) }),
    getTodayStatus: (employeeId?: string) => apiFetch(`/attendance/today-status${employeeId ? `?employeeId=${employeeId}` : ''}`),
    startBreak: (data?: { breakType?: string; employeeId?: string }) =>
      apiFetch('/attendance/break/start', { method: 'POST', body: JSON.stringify(data || {}) }),
    endBreak: (data?: { employeeId?: string }) =>
      apiFetch('/attendance/break/end', { method: 'POST', body: JSON.stringify(data || {}) }),
    toggleBreak: (data?: { breakType?: string; employeeId?: string }) =>
      apiFetch('/attendance/break/toggle', { method: 'POST', body: JSON.stringify(data || {}) }),
    getHistory: () => apiFetch('/attendance/history'),
    submitRequest: (data: {
      type: 'WFH' | 'ON_DUTY' | 'REGULARIZATION' | 'SHORT_LEAVE'
      startDate: string
      endDate?: string
      reason: string
      location?: string
      inTime?: string
      outTime?: string
      employeeId?: string
      shortLeaveType?: 'EARLY_EXIT' | 'LATE_ENTRY'
      shortLeaveHours?: number
    }) => apiFetch('/attendance/requests', { method: 'POST', body: JSON.stringify(data) }),
    getRequests: (params?: { employeeId?: string; status?: string; type?: string }) => {
      const q = new URLSearchParams()
      if (params?.employeeId) q.set('employeeId', params.employeeId)
      if (params?.status) q.set('status', params.status)
      if (params?.type) q.set('type', params.type)
      const qs = q.toString()
      return apiFetch(`/attendance/requests${qs ? `?${qs}` : ''}`)
    },
    updateRequestStatus: (id: string, data: { status: 'APPROVED' | 'REJECTED'; adminRemark?: string }) =>
      apiFetch(`/attendance/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
    getMusterRoll: (params?: { year?: number; month?: number; department?: string; employeeId?: string }) => {
      const q = new URLSearchParams()
      if (params?.year) q.set('year', String(params.year))
      if (params?.month) q.set('month', String(params.month))
      if (params?.department) q.set('department', params.department)
      if (params?.employeeId) q.set('employeeId', params.employeeId)
      const qs = q.toString()
      return apiFetch(`/attendance/muster-roll${qs ? `?${qs}` : ''}`)
    },
    getLiveMonitoring: (params?: { department?: string; status?: string; search?: string }) => {
      const q = new URLSearchParams()
      if (params?.department) q.set('department', params.department)
      if (params?.status) q.set('status', params.status)
      if (params?.search) q.set('search', params.search)
      const qs = q.toString()
      return apiFetch(`/attendance/live-monitor${qs ? `?${qs}` : ''}`)
    },
    getWebPunchPermission: (employeeId: string) =>
      apiFetch(`/attendance/web-punch-permission/${employeeId}`),
    setWebPunchPermission: (data: { employeeId: string; allowed: boolean }) =>
      apiFetch('/attendance/web-punch-permission', { method: 'POST', body: JSON.stringify(data) }),
    runClosure: (date?: string) =>
      apiFetch('/attendance/closure/run', { method: 'POST', body: JSON.stringify({ date }) }),
    getTodayReminders: (employeeId?: string) =>
      apiFetch(`/attendance/reminders/today${employeeId ? `?employeeId=${employeeId}` : ''}`),
    creditCompOff: (data: { attendanceId: string }) =>
      apiFetch('/attendance/compoff/credit', { method: 'POST', body: JSON.stringify(data) }),
    bulkImport: {
      getTemplate: () => apiFetch('/attendance/bulk-import/template'),
      validate: (data: { fileName?: string; rows: any[] }) =>
        apiFetch('/attendance/bulk-import/validate', { method: 'POST', body: JSON.stringify(data) }),
      commit: (data: { fileName?: string; rows: any[]; uploadedBy?: string }) =>
        apiFetch('/attendance/bulk-import/commit', { method: 'POST', body: JSON.stringify(data) }),
    },
  },

  // ── Leaves ──
  leaves: {
    apply: (data: any) => apiFetch('/leaves', { method: 'POST', body: JSON.stringify(data) }),
    getMyLeaves: () => apiFetch('/leaves/my'),
    getBalance: () => apiFetch('/leaves/balance'),
    getTeamCalendar: (params?: { department?: string; locationId?: string; year?: number; month?: number }) => {
      const q = new URLSearchParams()
      if (params?.department) q.set('department', params.department)
      if (params?.locationId) q.set('locationId', params.locationId)
      if (params?.year) q.set('year', String(params.year))
      if (params?.month) q.set('month', String(params.month))
      const qs = q.toString()
      return apiFetch(`/leaves/team-calendar${qs ? `?${qs}` : ''}`)
    },
    getAll: (status?: string) => apiFetch(`/leaves${status ? `?status=${status}` : ''}`),
    updateStatus: (id: string, status: string, adminRemark?: string) => {
      if (id && String(id).startsWith('req_')) {
        const normStatus = (status === 'Approved' || status === 'APPROVED') ? 'APPROVED' : 'REJECTED';
        return apiFetch(`/attendance/requests/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: normStatus, adminRemark }),
        });
      }
      return apiFetch(`/leaves/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, adminRemark }) });
    },
    cancel: (id: string) => {
      if (id && String(id).startsWith('req_')) {
        return apiFetch(`/attendance/requests/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REJECTED', adminRemark: 'Cancelled by requester' }),
        });
      }
      return apiFetch(`/leaves/${id}`, { method: 'DELETE' });
    },
    getWorkWeekRoster: (params?: { year?: number; month?: number }) => {
      const q = new URLSearchParams()
      if (params?.year) q.set('year', String(params.year))
      if (params?.month) q.set('month', String(params.month))
      const qs = q.toString()
      return apiFetch(`/leaves/work-week-roster${qs ? `?${qs}` : ''}`)
    },
    updateWorkWeekRoster: (data: { pattern: string; customWeekOffDays?: number[] }) =>
      apiFetch('/leaves/work-week-roster', { method: 'POST', body: JSON.stringify(data) }),
    calculateDays: (data: { startDate: string; endDate: string; pattern?: string }) =>
      apiFetch('/leaves/calculate-days', { method: 'POST', body: JSON.stringify(data) }),
    getRosterGrid: (params?: {
      year?: number
      month?: number
      view?: 'weekly' | 'monthly'
      weekIndex?: number
      department?: string
      search?: string
    }) => {
      const q = new URLSearchParams()
      if (params?.year) q.set('year', String(params.year))
      if (params?.month) q.set('month', String(params.month))
      if (params?.view) q.set('view', params.view)
      if (params?.weekIndex !== undefined) q.set('weekIndex', String(params.weekIndex))
      if (params?.department) q.set('department', params.department)
      if (params?.search) q.set('search', params.search)
      const qs = q.toString()
      return apiFetch(`/leaves/roster-grid${qs ? `?${qs}` : ''}`)
    },
    bulkAssignRoster: (data: {
      employeeIds?: string[]
      department?: string
      pattern: string
      shiftCode?: string
      customWeekOffDays?: number[]
      applyToAll?: boolean
    }) => apiFetch('/leaves/roster-bulk-assign', { method: 'POST', body: JSON.stringify(data) }),
    createRosterSchedule: (data: {
      employeeIds?: string[]
      department?: string
      applyToAll?: boolean
      startDate: string
      endDate: string
      shiftCode: string
      workingDays?: number[]
      saturdayRule?: 'ALL_WORKING' | '2ND_4TH_OFF' | '1ST_3RD_OFF' | 'ALL_OFF'
    }) => apiFetch('/leaves/roster-create-schedule', { method: 'POST', body: JSON.stringify(data) }),
    overrideRosterCell: (data: {
      employeeId: string
      dateStr: string
      shiftCode: string
    }) => apiFetch('/leaves/roster-cell-override', { method: 'POST', body: JSON.stringify(data) }),
    getShifts: () => apiFetch('/leaves/shifts'),
    createOrUpdateShift: (data: {
      code: string
      name: string
      category?: 'GENERAL' | 'NIGHT' | 'ROTATIONAL' | 'SPLIT'
      startTime?: string
      endTime?: string
      firstSlotStartTime?: string
      firstSlotEndTime?: string
      secondSlotStartTime?: string
      secondSlotEndTime?: string
      rotationCycleDays?: number
      gracePeriodMinutes?: number
      halfDayHours?: number
      color?: string
      badgeClass?: string
    }) => apiFetch('/leaves/shifts', { method: 'POST', body: JSON.stringify(data) }),
    deleteShift: (code: string) => apiFetch(`/leaves/shifts/${code}`, { method: 'DELETE' }),

    // Accrual Engine & Group Plans
    accrual: {
      listPlans: () => apiFetch('/leaves/accrual/plans'),
      upsertPlan: (data: any) =>
        apiFetch('/leaves/accrual/plans', { method: 'POST', body: JSON.stringify(data) }),
      deletePlan: (id: string) =>
        apiFetch(`/leaves/accrual/plans/${id}`, { method: 'DELETE' }),
      previewAccrual: (params?: { asOfDate?: string; employeeId?: string; planId?: string; department?: string }) => {
        const q = new URLSearchParams()
        if (params?.asOfDate) q.set('asOfDate', params.asOfDate)
        if (params?.employeeId) q.set('employeeId', params.employeeId)
        if (params?.planId) q.set('planId', params.planId)
        if (params?.department) q.set('department', params.department)
        const qs = q.toString()
        return apiFetch(`/leaves/accrual/preview${qs ? `?${qs}` : ''}`)
      },
      runAccrualNow: (data: { asOfDate?: string; employeeId?: string; force?: boolean; planId?: string; department?: string }) =>
        apiFetch('/leaves/accrual/run-now', { method: 'POST', body: JSON.stringify(data) }),
      previewYearEnd: (params?: { cycleYear?: number; planId?: string; department?: string }) => {
        const q = new URLSearchParams()
        if (params?.cycleYear !== undefined) q.set('cycleYear', String(params.cycleYear))
        if (params?.planId) q.set('planId', params.planId)
        if (params?.department) q.set('department', params.department)
        const qs = q.toString()
        return apiFetch(`/leaves/accrual/year-end/preview${qs ? `?${qs}` : ''}`)
      },
      executeYearEnd: (data: { cycleYear: number; planId?: string; department?: string }) =>
        apiFetch('/leaves/accrual/year-end/execute', { method: 'POST', body: JSON.stringify(data) }),
      requestEncashment: (data: {
        employeeId: string
        leaveType?: string
        daysToEncash: number
        ratePerDay?: number
        reason?: string
        planId?: string
      }) => apiFetch('/leaves/accrual/encashment', { method: 'POST', body: JSON.stringify(data) }),
      getLedger: (params?: { employeeId?: string }) => {
        const q = new URLSearchParams()
        if (params?.employeeId) q.set('employeeId', params.employeeId)
        const qs = q.toString()
        return apiFetch(`/leaves/accrual/ledger${qs ? `?${qs}` : ''}`)
      },
      importOpeningBalances: (rows: any[]) =>
        apiFetch('/leaves/accrual/opening-balances/import', { method: 'POST', body: JSON.stringify({ rows }) }),
      listLopReversals: (params?: { status?: string; employeeId?: string; month?: string }) => {
        const q = new URLSearchParams()
        if (params?.status) q.set('status', params.status)
        if (params?.employeeId) q.set('employeeId', params.employeeId)
        if (params?.month) q.set('month', params.month)
        const qs = q.toString()
        return apiFetch(`/leaves/accrual/lop-reversals${qs ? `?${qs}` : ''}`)
      },
      markLopRefunded: (id: string, cycleMonth?: string) =>
        apiFetch(`/leaves/accrual/lop-reversals/${id}/mark-refunded`, {
          method: 'POST',
          body: JSON.stringify({ cycleMonth }),
        }),
    },
  },

  // ── Holidays ──
  holidays: {
    getAll: (activeOnly: boolean = false) => apiFetch(`/holidays${activeOnly ? '?activeOnly=true' : ''}`),
    create: (data: any) => apiFetch('/holidays', { method: 'POST', body: JSON.stringify(data) }),
    bulkCreate: (holidays: any[]) => apiFetch('/holidays/bulk', { method: 'POST', body: JSON.stringify({ holidays }) }),
    delete: (id: string) => apiFetch(`/holidays/${id}`, { method: 'DELETE' }),
    previewCopy: (fromYear?: number, toYear?: number) => {
      const q = new URLSearchParams()
      if (fromYear !== undefined) q.set('fromYear', String(fromYear))
      if (toYear !== undefined) q.set('toYear', String(toYear))
      const qs = q.toString()
      return apiFetch(`/holidays/copy-preview${qs ? `?${qs}` : ''}`)
    },
    executeCopy: (data: { fromYear: number; toYear: number; selections?: any[] }) =>
      apiFetch('/holidays/copy-execute', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── Tasks ──
  tasks: {
    getAll: () => apiFetch('/tasks'),
    getById: (id: string) => apiFetch(`/tasks/${id}`),
    getByEmployee: (employeeId: string) => apiFetch(`/tasks/employee/${employeeId}`),
    create: (data: any) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    createSelf: (data: any) => apiFetch('/tasks/self', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      apiFetch(`/tasks/status/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id: string) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
  },

  projects: {
    getAll: () => apiFetch('/projects'),
    getById: (id: string) => apiFetch(`/projects/${id}`),
    create: (data: any) => apiFetch('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/projects/${id}`, { method: 'DELETE' }),
  },

  // ── Assets ──
  assets: {
    getAll: () => apiFetch('/assets'),
    getById: (id: string) => apiFetch(`/assets/${id}`),
    create: (data: any) => apiFetch('/assets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/assets/${id}`, { method: 'DELETE' }),
    getAllocations: () => apiFetch('/assets/allocations'),
    assign: (data: any) => apiFetch('/assets/assign', { method: 'POST', body: JSON.stringify(data) }),
    return: (allocationId: string, data: any) =>
      apiFetch(`/assets/return/${allocationId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Documents ──
  documents: {
    getAll: (filters?: { category?: string; employeeId?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.employeeId) params.set('employeeId', filters.employeeId);
      if (filters?.status) params.set('status', filters.status);
      const qs = params.toString();
      return apiFetch(`/documents${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => apiFetch(`/documents/${id}`),
    create: (data: any) => apiFetch('/documents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archive: (id: string) => apiFetch(`/documents/${id}/archive`, { method: 'PATCH' }),
    delete: (id: string) => apiFetch(`/documents/${id}`, { method: 'DELETE' }),
  },

  // ── Performance ──
  performance: {
    getAll: (filters?: { employeeId?: string; status?: string; cycleType?: string }) => {
      const params = new URLSearchParams();
      if (filters?.employeeId) params.set('employeeId', filters.employeeId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.cycleType) params.set('cycleType', filters.cycleType);
      const qs = params.toString();
      return apiFetch(`/performance${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => apiFetch(`/performance/${id}`),
    getMyReviews: () => apiFetch('/performance/my'),
    create: (data: any) => apiFetch('/performance', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch(`/performance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    submitSelfReview: (id: string, data: { rating: number; comments: string }) =>
      apiFetch(`/performance/${id}/self-review`, { method: 'PATCH', body: JSON.stringify(data) }),
    submitManagerReview: (id: string, data: { rating: number; feedback: string }) =>
      apiFetch(`/performance/${id}/manager-review`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/performance/${id}`, { method: 'DELETE' }),
    compute: (data: { employeeId: string; cycle: string; cycleType?: string; managerScore?: number }) =>
      apiFetch('/performance/compute', { method: 'POST', body: JSON.stringify(data) }),
    refresh: (id: string) => apiFetch(`/performance/${id}/refresh`, { method: 'POST' }),
    getAnalytics: (cycle: string, cycleType?: string) => {
      const params = new URLSearchParams({ cycle });
      if (cycleType) params.set('cycleType', cycleType);
      return apiFetch(`/performance/analytics?${params}`);
    },
  },

  // ── Onboarding ──
  onboarding: {
    getAll: (status?: string) => apiFetch(`/onboarding${status ? `?status=${status}` : ''}`),
    getById: (id: string) => apiFetch(`/onboarding/${id}`),
    create: (data: any) => apiFetch('/onboarding', { method: 'POST', body: JSON.stringify(data) }),
    bulkImport: (candidates: any[], source = 'BULK_IMPORT') =>
      apiFetch('/onboarding/bulk', { method: 'POST', body: JSON.stringify({ candidates, source }) }),
    update: (id: string, data: any) => apiFetch(`/onboarding/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateTask: (id: string, taskLabel: string, done: boolean) =>
      apiFetch(`/onboarding/${id}/task`, { method: 'PATCH', body: JSON.stringify({ taskLabel, done }) }),
    complete: (id: string, options?: {
      createLogin?: boolean;
      password?: string;
      role?: string;
      sendWelcomeEmail?: boolean;
      locationId?: string;
      orgUnitId?: string;
      employeeCode?: string;
    }) => apiFetch(`/onboarding/${id}/complete`, { method: 'POST', body: JSON.stringify(options || {}) }),
    delete: (id: string) => apiFetch(`/onboarding/${id}`, { method: 'DELETE' }),
  },

  compensation: {
    listProfiles: (country?: string) =>
      apiFetch(`/compensation/profiles${country ? `?country=${encodeURIComponent(country)}` : ''}`),
    matchProfile: (params: { country?: string; region?: string; city?: string; locality?: string }) => {
      const q = new URLSearchParams()
      if (params.country) q.set('country', params.country)
      if (params.region) q.set('region', params.region)
      if (params.city) q.set('city', params.city)
      if (params.locality) q.set('locality', params.locality)
      const qs = q.toString()
      return apiFetch(`/compensation/profiles/match${qs ? `?${qs}` : ''}`)
    },
    getProfile: (id: string) => apiFetch(`/compensation/profiles/${id}`),
    createProfile: (data: any) => apiFetch('/compensation/profiles', { method: 'POST', body: JSON.stringify(data) }),
    updateProfile: (id: string, data: any) =>
      apiFetch(`/compensation/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProfile: (id: string) => apiFetch(`/compensation/profiles/${id}`, { method: 'DELETE' }),
    calculate: (data: any) => apiFetch('/compensation/calculate', { method: 'POST', body: JSON.stringify(data) }),
    getEmployee: (employeeId: string) => apiFetch(`/compensation/employee/${employeeId}`),
    updateEmployee: (employeeId: string, data: any) =>
      apiFetch(`/compensation/employee/${employeeId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getOnboarding: (onboardingId: string) => apiFetch(`/compensation/onboarding/${onboardingId}`),
    updateOnboarding: (onboardingId: string, data: any) =>
      apiFetch(`/compensation/onboarding/${onboardingId}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  masterData: {
    getAll: () => apiFetch('/master-data'),
    upsertDepartment: (data: any) =>
      apiFetch('/master-data/departments', { method: 'POST', body: JSON.stringify(data) }),
    deleteDepartment: (id: string) =>
      apiFetch(`/master-data/departments/${id}`, { method: 'DELETE' }),
    upsertDesignation: (data: any) =>
      apiFetch('/master-data/designations', { method: 'POST', body: JSON.stringify(data) }),
    deleteDesignation: (id: string) =>
      apiFetch(`/master-data/designations/${id}`, { method: 'DELETE' }),
    upsertGrade: (data: any) =>
      apiFetch('/master-data/grades', { method: 'POST', body: JSON.stringify(data) }),
    deleteGrade: (id: string) =>
      apiFetch(`/master-data/grades/${id}`, { method: 'DELETE' }),
    upsertCostCentre: (data: any) =>
      apiFetch('/master-data/cost-centres', { method: 'POST', body: JSON.stringify(data) }),
    deleteCostCentre: (id: string) =>
      apiFetch(`/master-data/cost-centres/${id}`, { method: 'DELETE' }),
  },

  customFields: {
    list: (includeInactive?: boolean) =>
      apiFetch(`/custom-fields${includeInactive ? '?includeInactive=true' : ''}`),
    create: (data: any) =>
      apiFetch('/custom-fields', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch(`/custom-fields/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch(`/custom-fields/${id}`, { method: 'DELETE' }),
    seedDefaults: () =>
      apiFetch('/custom-fields/seed-defaults', { method: 'POST' }),
    updateEmployeeValues: (employeeId: string, values: any) =>
      apiFetch(`/custom-fields/employee/${employeeId}`, { method: 'PUT', body: JSON.stringify(values) }),
  },

  // ── HR Setup Templates ──
  templates: {
    getAll: (type?: string) =>
      apiFetch(`/templates${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    getById: (id: string) => apiFetch(`/templates/${id}`),
    create: (data: any) => apiFetch('/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/templates/${id}`, { method: 'DELETE' }),
    duplicate: (id: string, data?: { newName?: string; newCode?: string }) =>
      apiFetch(`/templates/${id}/duplicate`, { method: 'POST', body: JSON.stringify(data || {}) }),
    apply: (id: string, data: { employeeIds?: string[]; targetType?: string; targetId?: string }) =>
      apiFetch(`/templates/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
    seedStandards: () => apiFetch('/templates/seed-standards', { method: 'POST' }),
  },

  // ── Compliance & Terms/Privacy Acceptance ──
  compliance: {
    listDocuments: () => apiFetch('/compliance/documents'),
    getPending: () => apiFetch('/compliance/pending'),
    accept: (documentId: string, metadata?: any) =>
      apiFetch('/compliance/accept', { method: 'POST', body: JSON.stringify({ documentId, metadata }) }),
    acceptAll: () =>
      apiFetch('/compliance/accept-all', { method: 'POST' }),
    publishNewVersion: (documentId: string, data: { newVersion: string; title?: string; content?: string; summary?: string; effectiveDate?: string; isMandatory?: boolean }) =>
      apiFetch(`/compliance/documents/${documentId}/publish-version`, { method: 'POST', body: JSON.stringify(data) }),
    getAuditTrail: (params?: { documentId?: string; documentType?: string; userId?: string; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.documentId) q.set('documentId', params.documentId);
      if (params?.documentType) q.set('documentType', params.documentType);
      if (params?.userId) q.set('userId', params.userId);
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return apiFetch(`/compliance/audit-trail${qs ? `?${qs}` : ''}`);
    },
    getOverview: () => apiFetch('/compliance/overview'),
    seedStandards: () => apiFetch('/compliance/seed-standards', { method: 'POST' }),
  },

  // ── Training & Statutory Courses (POSH, Safety) ──
  training: {
    listCourses: (category?: string) =>
      apiFetch(`/training/courses${category ? `?category=${encodeURIComponent(category)}` : ''}`),
    getMyAssignments: () => apiFetch('/training/my-assignments'),
    listAssignments: (params?: { courseId?: string; category?: string; department?: string; status?: string; isOverdue?: boolean; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.courseId) q.set('courseId', params.courseId);
      if (params?.category) q.set('category', params.category);
      if (params?.department) q.set('department', params.department);
      if (params?.status) q.set('status', params.status);
      if (params?.isOverdue !== undefined) q.set('isOverdue', String(params.isOverdue));
      if (params?.page) q.set('page', String(params.page));
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return apiFetch(`/training/assignments${qs ? `?${qs}` : ''}`);
    },
    assign: (data: { courseId: string; employeeIds?: string[]; department?: string; targetAll?: boolean; dueInDays?: number; notes?: string }) =>
      apiFetch('/training/assign', { method: 'POST', body: JSON.stringify(data) }),
    updateProgress: (assignmentId: string, data: { status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; score?: number; certificateUrl?: string; notes?: string }) =>
      apiFetch(`/training/assignments/${assignmentId}/progress`, { method: 'POST', body: JSON.stringify(data) }),
    sendReminders: (courseId?: string) =>
      apiFetch('/training/reminders', { method: 'POST', body: JSON.stringify({ courseId }) }),
    getComplianceDashboard: () => apiFetch('/training/compliance-dashboard'),
    seedStandards: () => apiFetch('/training/seed-standards', { method: 'POST' }),
  },

  // ── Compensation Planning & Increment Cycles ──
  compensationPlanning: {
    listCycles: () => apiFetch('/compensation/planning/cycles'),
    createCycle: (data: any) =>
      apiFetch('/compensation/planning/cycles', { method: 'POST', body: JSON.stringify(data) }),
    getCycleDashboard: (cycleId: string) =>
      apiFetch(`/compensation/planning/cycles/${cycleId}/dashboard`),
    allocatePool: (data: { cycleId: string; department: string; allocatedBudget: number }) =>
      apiFetch('/compensation/planning/pools', { method: 'POST', body: JSON.stringify(data) }),
    generateRecommendations: (cycleId: string) =>
      apiFetch(`/compensation/planning/cycles/${cycleId}/generate-recommendations`, { method: 'POST' }),
    updateRecommendation: (id: string, data: any) =>
      apiFetch(`/compensation/planning/recommendations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    applyCycle: (cycleId: string) =>
      apiFetch(`/compensation/planning/cycles/${cycleId}/apply`, { method: 'POST' }),
  },

  // ── Succession Planning, Skill Matrix & 9-Box Grid ──
  talentSuccession: {
    seedSkills: () => apiFetch('/performance/succession/skills/seed-standards', { method: 'POST' }),
    listSkills: (category?: string) =>
      apiFetch(`/performance/succession/skills${category ? `?category=${encodeURIComponent(category)}` : ''}`),
    getEmployeeSkillMatrix: (employeeId: string) =>
      apiFetch(`/performance/succession/employees/${employeeId}/skills`),
    recordSkillProficiency: (employeeId: string, skillId: string, proficiencyLevel: number) =>
      apiFetch(`/performance/succession/employees/${employeeId}/skills`, {
        method: 'POST',
        body: JSON.stringify({ skillId, proficiencyLevel }),
      }),
    assessTalent: (employeeId: string, data: any) =>
      apiFetch(`/performance/succession/employees/${employeeId}/assess`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getNineBoxMatrix: (year?: string) =>
      apiFetch(`/performance/succession/nine-box${year ? `?year=${encodeURIComponent(year)}` : ''}`),
    listPlans: (department?: string) =>
      apiFetch(`/performance/succession/plans${department ? `?department=${encodeURIComponent(department)}` : ''}`),
    createPlan: (data: any) =>
      apiFetch('/performance/succession/plans', { method: 'POST', body: JSON.stringify(data) }),
    addCandidate: (planId: string, data: any) =>
      apiFetch(`/performance/succession/plans/${planId}/candidates`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ── Workforce Planning (Headcount Budget vs Actual) ──
  workforce: {
    seedHeadcountPlans: (fiscalYear?: string) =>
      apiFetch('/workforce/headcount-plans/seed-standards', {
        method: 'POST',
        body: JSON.stringify({ fiscalYear }),
      }),
    getBudgetVsActual: (fiscalYear?: string) =>
      apiFetch(`/workforce/headcount-budget-vs-actual${fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : ''}`),
    setHeadcountPlan: (data: any) =>
      apiFetch('/workforce/headcount-plans', { method: 'POST', body: JSON.stringify(data) }),
    listRequisitions: (params?: { department?: string; status?: string }) => {
      const q = new URLSearchParams();
      if (params?.department) q.set('department', params.department);
      if (params?.status) q.set('status', params.status);
      const qs = q.toString();
      return apiFetch(`/workforce/requisitions${qs ? `?${qs}` : ''}`);
    },
    createRequisition: (data: any) =>
      apiFetch('/workforce/requisitions', { method: 'POST', body: JSON.stringify(data) }),
    approveRequisition: (id: string, approvalNotes?: string) =>
      apiFetch(`/workforce/requisitions/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvalNotes }),
      }),
  },
};
