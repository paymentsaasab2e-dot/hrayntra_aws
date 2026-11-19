import prisma from '../../../shared/prisma';
import { OrgScopeContext, employeeWhereFromScope } from '../../../shared/org/org-scope.service';
import { requireTenantId } from '../../../shared/tenant/tenant-scope';

export interface OrgChartNode {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone?: string | null;
  designation: string;
  department: string;
  locationName?: string | null;
  orgUnitName?: string | null;
  avatar?: string | null;
  joiningDate: string;
  dateOfBirth?: string | null;
  status: string;
  reportsToUserId?: string | null;
  manager?: {
    id: string;
    employeeId: string;
    name: string;
    designation: string;
  } | null;
  directReportsCount: number;
  totalDescendantsCount: number;
  depth: number;
  children: OrgChartNode[];
}

export type CelebrationType = 'BIRTHDAY' | 'WORK_ANNIVERSARY' | 'NEW_JOINER';

export interface CelebrationItem {
  id: string;
  type: CelebrationType;
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    designation: string;
    department: string;
    locationName?: string | null;
    avatar?: string | null;
  };
  date: string;
  displayDate: string;
  daysRemaining: number;
  daysSinceJoining?: number;
  isToday: boolean;
  isThisWeek: boolean;
  isThisMonth: boolean;
  isMilestone?: boolean;
  milestoneTitle: string;
  tenureYears?: number;
  turningAge?: number;
  badge: string;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export class OrgChartService {
  /**
   * Retrieves the full reporting hierarchy tree for the organization.
   * Resolves manager reporting lines (supports reportsToUserId pointing to User.id or Employee.id).
   */
  static async getReportingTree(scope: OrgScopeContext, rootEmployeeId?: string) {
    const tenantId = requireTenantId(scope);

    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        status: { not: 'TERMINATED' },
      },
      include: {
        user: { select: { id: true, email: true, role: true } },
        location: { select: { id: true, name: true } },
        orgUnit: { select: { id: true, name: true, levelOrder: true } },
      },
      orderBy: { employeeId: 'asc' },
    });

    if (employees.length === 0) {
      return {
        roots: [],
        totalEmployees: 0,
        departments: [],
        maxDepth: 0,
      };
    }

    // Build fast lookup maps:
    // 1. By employee ID
    // 2. By linked User ID (if any)
    const empById = new Map<string, typeof employees[0]>();
    const empByUserId = new Map<string, typeof employees[0]>();

    for (const emp of employees) {
      empById.set(emp.id, emp);
      if (emp.userId) {
        empByUserId.set(emp.userId, emp);
      }
    }

    // Helper to find an employee's manager in this tenant
    const findManager = (emp: typeof employees[0]): typeof employees[0] | null => {
      if (!emp.reportsToUserId) return null;
      // Match by User ID or direct Employee ID
      const mgr = empByUserId.get(emp.reportsToUserId) || empById.get(emp.reportsToUserId);
      if (mgr && mgr.id !== emp.id) {
        return mgr;
      }
      return null;
    };

    // Build children mapping (manager Employee.id -> direct report Employee[])
    const childrenMap = new Map<string, typeof employees>();
    const roots: typeof employees = [];

    for (const emp of employees) {
      const manager = findManager(emp);
      if (manager) {
        const existing = childrenMap.get(manager.id) || [];
        existing.push(emp);
        childrenMap.set(manager.id, existing);
      } else {
        roots.push(emp);
      }
    }

    // In the edge case where cycles prevent root detection, select the first employee as root
    const effectiveRoots = roots.length > 0 ? roots : [employees[0]];

    let maxDepthOverall = 1;

    // Recursive tree node builder with cycle protection
    const buildNode = (emp: typeof employees[0], currentDepth: number, visited: Set<string>): OrgChartNode => {
      visited.add(emp.id);
      if (currentDepth > maxDepthOverall) {
        maxDepthOverall = currentDepth;
      }

      const manager = findManager(emp);
      const rawChildren = childrenMap.get(emp.id) || [];
      const safeChildren = rawChildren.filter((c) => !visited.has(c.id));

      const childrenNodes: OrgChartNode[] = safeChildren.map((child) =>
        buildNode(child, currentDepth + 1, new Set(visited))
      );

      const totalDescendantsCount = childrenNodes.reduce(
        (sum, child) => sum + 1 + child.totalDescendantsCount,
        0
      );

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        phone: emp.phone,
        designation: emp.designation,
        department: emp.department,
        locationName: emp.location?.name || null,
        orgUnitName: emp.orgUnit?.name || null,
        avatar: emp.avatar || null,
        joiningDate: emp.joiningDate ? emp.joiningDate.toISOString() : new Date().toISOString(),
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString() : null,
        status: emp.status,
        reportsToUserId: emp.reportsToUserId,
        manager: manager
          ? {
              id: manager.id,
              employeeId: manager.employeeId,
              name: `${manager.firstName} ${manager.lastName}`.trim(),
              designation: manager.designation,
            }
          : null,
        directReportsCount: childrenNodes.length,
        totalDescendantsCount,
        depth: currentDepth,
        children: childrenNodes,
      };
    };

    let resultRoots: OrgChartNode[] = [];

    if (rootEmployeeId) {
      const specificEmp = empById.get(rootEmployeeId);
      if (specificEmp) {
        resultRoots = [buildNode(specificEmp, 1, new Set())];
      }
    } else {
      resultRoots = effectiveRoots.map((r) => buildNode(r, 1, new Set()));
    }

    const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort();

    return {
      roots: resultRoots,
      totalEmployees: employees.length,
      rootCount: resultRoots.length,
      maxDepth: maxDepthOverall,
      departments,
    };
  }

  /**
   * Retrieves celebrations directory (Birthdays, Work Anniversaries, New Joiners)
   * with timeframe calculations, milestone detection, and monthly metrics.
   */
  static async getCelebrations(
    scope: OrgScopeContext,
    options?: { month?: number; timeframe?: 'all' | 'today' | 'week' | 'month'; type?: CelebrationType }
  ) {
    const tenantId = requireTenantId(scope);

    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        status: { not: 'TERMINATED' },
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    // Normalized start of today (local / UTC midnight)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const items: CelebrationItem[] = [];

    let birthdaysThisMonth = 0;
    let anniversariesThisMonth = 0;
    let newJoinersCount = 0;
    let todayCount = 0;

    for (const emp of employees) {
      const empData = {
        id: emp.id,
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.email,
        designation: emp.designation,
        department: emp.department,
        locationName: emp.location?.name || null,
        avatar: emp.avatar || null,
      };

      // ── 1. Birthday Calculation ──
      if (emp.dateOfBirth) {
        const dob = new Date(emp.dateOfBirth);
        const birthMonth = dob.getMonth();
        const birthDate = dob.getDate();

        // Calculate next birthday
        let nextBday = new Date(now.getFullYear(), birthMonth, birthDate);
        if (nextBday < startOfToday) {
          nextBday = new Date(now.getFullYear() + 1, birthMonth, birthDate);
        }

        const diffMs = nextBday.getTime() - startOfToday.getTime();
        const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const turningAge = nextBday.getFullYear() - dob.getFullYear();

        const isToday = daysRemaining === 0;
        const isThisWeek = daysRemaining >= 0 && daysRemaining <= 7;
        const isThisMonth = nextBday.getMonth() === now.getMonth();

        if (birthMonth === now.getMonth()) {
          birthdaysThisMonth++;
        }
        if (isToday) {
          todayCount++;
        }

        const badge = isToday
          ? 'Today! 🎂'
          : daysRemaining === 1
          ? 'Tomorrow 🎂'
          : `In ${daysRemaining} days`;

        items.push({
          id: `bday-${emp.id}`,
          type: 'BIRTHDAY',
          employee: empData,
          date: nextBday.toISOString(),
          displayDate: nextBday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          daysRemaining,
          isToday,
          isThisWeek,
          isThisMonth,
          turningAge,
          milestoneTitle: `Turning ${turningAge}`,
          badge,
        });
      }

      // ── 2. Work Anniversary Calculation ──
      if (emp.joiningDate) {
        const joinDate = new Date(emp.joiningDate);
        const joinMonth = joinDate.getMonth();
        const joinDay = joinDate.getDate();

        let nextAnniv = new Date(now.getFullYear(), joinMonth, joinDay);
        if (nextAnniv < startOfToday) {
          nextAnniv = new Date(now.getFullYear() + 1, joinMonth, joinDay);
        }

        const tenureYears = nextAnniv.getFullYear() - joinDate.getFullYear();

        // Only count work anniversaries for employees who have at least reached or will reach 1 year
        if (tenureYears >= 1) {
          const diffMs = nextAnniv.getTime() - startOfToday.getTime();
          const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

          const isToday = daysRemaining === 0;
          const isThisWeek = daysRemaining >= 0 && daysRemaining <= 7;
          const isThisMonth = nextAnniv.getMonth() === now.getMonth();
          const isMilestone = [1, 3, 5, 10, 15, 20, 25, 30].includes(tenureYears);

          if (joinMonth === now.getMonth()) {
            anniversariesThisMonth++;
          }
          if (isToday) {
            todayCount++;
          }

          const badge = isToday
            ? 'Today! 🏆'
            : daysRemaining === 1
            ? 'Tomorrow 🏆'
            : `In ${daysRemaining} days`;

          items.push({
            id: `anniv-${emp.id}`,
            type: 'WORK_ANNIVERSARY',
            employee: empData,
            date: nextAnniv.toISOString(),
            displayDate: nextAnniv.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            daysRemaining,
            isToday,
            isThisWeek,
            isThisMonth,
            isMilestone,
            tenureYears,
            milestoneTitle: `${tenureYears}${getOrdinalSuffix(tenureYears)} Work Anniversary`,
            badge,
          });
        }

        // ── 3. New Joiner Calculation (< 30 days) ──
        const startOfJoinDay = new Date(joinDate.getFullYear(), joinDate.getMonth(), joinDate.getDate());
        const daysSinceJoining = Math.floor((startOfToday.getTime() - startOfJoinDay.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceJoining >= 0 && daysSinceJoining <= 30) {
          newJoinersCount++;
          const isToday = daysSinceJoining === 0;
          if (isToday) todayCount++;

          const badge = isToday
            ? 'Joined Today! 🚀'
            : daysSinceJoining === 1
            ? 'Joined Yesterday'
            : `Joined ${daysSinceJoining}d ago`;

          items.push({
            id: `joiner-${emp.id}`,
            type: 'NEW_JOINER',
            employee: empData,
            date: emp.joiningDate.toISOString(),
            displayDate: joinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            daysRemaining: 0,
            daysSinceJoining,
            isToday,
            isThisWeek: daysSinceJoining <= 7,
            isThisMonth: daysSinceJoining <= 30,
            milestoneTitle: 'New Team Member',
            badge,
          });
        }
      }
    }

    // Filter by options if specified
    let filteredItems = items;

    if (options?.type) {
      filteredItems = filteredItems.filter((item) => item.type === options.type);
    }

    if (options?.timeframe === 'today') {
      filteredItems = filteredItems.filter((item) => item.isToday);
    } else if (options?.timeframe === 'week') {
      filteredItems = filteredItems.filter((item) => item.isThisWeek || item.isToday);
    } else if (options?.timeframe === 'month') {
      filteredItems = filteredItems.filter((item) => item.isThisMonth || item.isToday);
    }

    if (typeof options?.month === 'number' && options.month >= 0 && options.month <= 11) {
      const selectedMonth = options.month;
      filteredItems = filteredItems.filter((item) => {
        const itemMonth = new Date(item.date).getMonth();
        return itemMonth === selectedMonth;
      });
    }

    // Sort: Today's items first, then by ascending daysRemaining, then new joiners
    filteredItems.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;

      if (a.type === 'NEW_JOINER' && b.type === 'NEW_JOINER') {
        return (a.daysSinceJoining || 0) - (b.daysSinceJoining || 0);
      }
      return a.daysRemaining - b.daysRemaining;
    });

    return {
      stats: {
        birthdaysThisMonth,
        anniversariesThisMonth,
        newJoinersCount,
        todayCount,
        totalUpcoming: items.length,
      },
      items: filteredItems,
    };
  }

  /**
   * Sends a celebratory wish / greeting to an employee.
   * Persists to CelebrationWish model and returns recorded message.
   */
  static async sendCelebrationWish(
    scope: OrgScopeContext,
    senderUserId: string,
    targetEmployeeId: string,
    payload: { type: string; message: string; greetingType?: string }
  ) {
    const tenantId = requireTenantId(scope);

    const targetEmp = await prisma.employee.findFirst({
      where: { id: targetEmployeeId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!targetEmp) {
      throw new Error('Recipient employee not found');
    }

    // Lookup sender name from Employee or User
    let senderName = 'A Teammate';
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(senderUserId);

    if (isValidObjectId) {
      const senderEmp = await prisma.employee.findFirst({
        where: { userId: senderUserId, tenantId },
        select: { firstName: true, lastName: true },
      });

      if (senderEmp) {
        senderName = `${senderEmp.firstName} ${senderEmp.lastName}`.trim();
      } else {
        const user = await prisma.user.findUnique({
          where: { id: senderUserId },
          select: { displayName: true, email: true },
        });
        if (user?.displayName) senderName = user.displayName;
      }
    }

    const wish = await prisma.celebrationWish.create({
      data: {
        tenantId,
        senderUserId: isValidObjectId ? senderUserId : null,
        senderName,
        targetEmployeeId,
        targetName: `${targetEmp.firstName} ${targetEmp.lastName}`.trim(),
        type: payload.type || 'BIRTHDAY',
        message: payload.message?.trim() || 'Wishing you the very best!',
      },
    });

    return wish;
  }

  /**
   * Retrieves recent celebration wishes sent across the tenant or to a target employee.
   */
  static async getCelebrationWishes(scope: OrgScopeContext, targetEmployeeId?: string) {
    const tenantId = requireTenantId(scope);

    return prisma.celebrationWish.findMany({
      where: {
        tenantId,
        ...(targetEmployeeId && { targetEmployeeId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }
}
