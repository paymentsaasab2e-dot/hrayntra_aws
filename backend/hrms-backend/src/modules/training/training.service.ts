import prisma from '../../shared/prisma';
import { logger } from '../../shared/logger';

export interface CreateTrainingCourseInput {
  code: string;
  title: string;
  category: 'POSH' | 'SAFETY' | 'SECURITY' | 'COMPLIANCE' | 'TECHNICAL';
  description?: string;
  durationMinutes?: number;
  validityDays?: number;
  isMandatory?: boolean;
  targetDepartments?: string[];
  materialUrl?: string;
  passScorePercent?: number;
}

export interface AssignCourseInput {
  courseId: string;
  employeeIds?: string[];
  department?: string;
  targetAll?: boolean;
  dueInDays?: number;
  notes?: string;
}

export class TrainingService {
  /**
   * Seed standard statutory courses (POSH, Safety, DPDP, Code of Conduct)
   */
  static async seedStandardCourses(tenantId: string) {
    const standards: CreateTrainingCourseInput[] = [
      {
        code: 'TRN-POSH-2026',
        title: 'POSH: Prevention of Sexual Harassment (Annual Statutory 2026)',
        category: 'POSH',
        description: 'Mandatory annual training under Section 19 of the Sexual Harassment of Women at Workplace Act 2013. Covers definitions of unwelcome conduct, Internal Committee (IC) redressal process, bystander intervention, and non-retaliation protections.',
        durationMinutes: 45,
        validityDays: 365,
        isMandatory: true,
        passScorePercent: 80,
        materialUrl: 'https://materials.hrms.internal/courses/posh-2026-interactive.html',
      },
      {
        code: 'TRN-FIRE-SAFETY',
        title: 'Workplace Fire Safety & Emergency Evacuation Protocols',
        category: 'SAFETY',
        description: 'Occupational safety standards course on emergency evacuation assembly points, fire extinguisher types (PASS method), first-aid response, and workplace hazard mitigation.',
        durationMinutes: 30,
        validityDays: 365,
        isMandatory: true,
        passScorePercent: 75,
        materialUrl: 'https://materials.hrms.internal/courses/fire-safety-evac.html',
      },
      {
        code: 'TRN-DPDP-INFOSEC',
        title: 'Information Security & Digital Data Protection (DPDP Act 2023)',
        category: 'SECURITY',
        description: 'Comprehensive guidelines for handling employee personal information, phishing detection, multi-factor credential hygiene, and DPDP compliance for cloud applications.',
        durationMinutes: 40,
        validityDays: 365,
        isMandatory: true,
        passScorePercent: 80,
        materialUrl: 'https://materials.hrms.internal/courses/infosec-dpdp.html',
      },
      {
        code: 'TRN-CODE-ETHICS',
        title: 'Corporate Code of Conduct & Workplace Ethics',
        category: 'COMPLIANCE',
        description: 'Organizational ethics, conflict of interest declarations, anti-bribery regulations, fair treatment standards, and confidential whistleblower reporting channels.',
        durationMinutes: 35,
        validityDays: 365,
        isMandatory: true,
        passScorePercent: 80,
        materialUrl: 'https://materials.hrms.internal/courses/code-of-conduct.html',
      },
    ];

    const results = [];
    for (const c of standards) {
      const existing = await prisma.trainingCourse.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: c.code,
          },
        },
      });

      if (!existing) {
        const created = await prisma.trainingCourse.create({
          data: {
            tenantId,
            code: c.code,
            title: c.title,
            category: c.category,
            description: c.description,
            durationMinutes: c.durationMinutes || 45,
            validityDays: c.validityDays || 365,
            isMandatory: c.isMandatory ?? true,
            passScorePercent: c.passScorePercent || 80,
            materialUrl: c.materialUrl,
            targetDepartments: c.targetDepartments || [],
            isActive: true,
          },
        });
        results.push(created);
      } else {
        results.push(existing);
      }
    }

    logger.info('training.standards.seeded', { tenantId, count: results.length });
    return results;
  }

  /**
   * List courses for a tenant with assignment summary statistics
   */
  static async listCourses(tenantId: string, category?: string) {
    const where: any = { tenantId, isActive: true };
    if (category) where.category = category;

    const courses = await prisma.trainingCourse.findMany({
      where,
      orderBy: [{ isMandatory: 'desc' }, { category: 'asc' }],
      include: {
        assignments: {
          select: {
            id: true,
            status: true,
            score: true,
            dueDate: true,
          },
        },
      },
    });

    return courses.map((course: any) => {
      const total = course.assignments.length;
      const completed = course.assignments.filter((a: any) => a.status === 'COMPLETED').length;
      const inProgress = course.assignments.filter((a: any) => a.status === 'IN_PROGRESS').length;
      const overdue = course.assignments.filter(
        (a: any) => a.status !== 'COMPLETED' && new Date(a.dueDate) < new Date()
      ).length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const { assignments, ...rest } = course;
      return {
        ...rest,
        stats: {
          totalAssigned: total,
          completedCount: completed,
          inProgressCount: inProgress,
          overdueCount: overdue,
          completionRatePercent: rate,
        },
      };
    });
  }

  /**
   * Assign a course to employees (individually, by department, or all employees)
   */
  static async assignCourse(tenantId: string, input: AssignCourseInput) {
    const { courseId, employeeIds, department, targetAll, dueInDays = 30, notes } = input;

    const course = await prisma.trainingCourse.findFirst({
      where: { id: courseId, tenantId },
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Determine target employee list
    let targetEmployees: { id: string; firstName: string; lastName: string; department: string }[] = [];

    if (targetAll) {
      targetEmployees = await prisma.employee.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, department: true },
      });
    } else if (department) {
      targetEmployees = await prisma.employee.findMany({
        where: { tenantId, department, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, department: true },
      });
    } else if (employeeIds && employeeIds.length > 0) {
      targetEmployees = await prisma.employee.findMany({
        where: { tenantId, id: { in: employeeIds }, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, department: true },
      });
    } else {
      throw new Error('Please select employees, a department, or choose all employees');
    }

    if (targetEmployees.length === 0) {
      throw new Error('No matching active employees found to assign');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueInDays);

    let assignedCount = 0;
    let existingCount = 0;

    for (const emp of targetEmployees) {
      const existing = await prisma.trainingAssignment.findUnique({
        where: {
          tenantId_courseId_employeeId: {
            tenantId,
            courseId: course.id,
            employeeId: emp.id,
          },
        },
      });

      if (!existing) {
        await prisma.trainingAssignment.create({
          data: {
            tenantId,
            courseId: course.id,
            employeeId: emp.id,
            dueDate,
            status: 'NOT_STARTED',
            notes: notes || `Mandatory assignment for ${emp.department}`,
          },
        });
        assignedCount++;
      } else {
        existingCount++;
      }
    }

    logger.info('training.course.assigned', {
      tenantId,
      courseId: course.id,
      courseCode: course.code,
      assignedCount,
      existingCount,
      dueDate,
    });

    return {
      success: true,
      courseCode: course.code,
      courseTitle: course.title,
      totalTargeted: targetEmployees.length,
      assignedCount,
      alreadyAssignedCount: existingCount,
      dueDate,
    };
  }

  /**
   * Get assignments for a specific employee
   */
  static async getEmployeeAssignments(tenantId: string, employeeId: string) {
    const assignments = await prisma.trainingAssignment.findMany({
      where: { tenantId, employeeId },
      include: {
        course: true,
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    const now = new Date();
    return assignments.map((a: any) => {
      let isOverdue = false;
      if (a.status !== 'COMPLETED' && new Date(a.dueDate) < now) {
        isOverdue = true;
      }

      return {
        ...a,
        isOverdue,
      };
    });
  }

  /**
   * List all training assignments across the tenant with search and filter
   */
  static async listAllAssignments(
    tenantId: string,
    filters: {
      courseId?: string;
      category?: string;
      department?: string;
      status?: string;
      isOverdue?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (filters.courseId) where.courseId = filters.courseId;
    if (filters.status) where.status = filters.status;

    if (filters.category) {
      where.course = { category: filters.category };
    }

    if (filters.department) {
      where.employee = { department: filters.department };
    }

    if (filters.isOverdue) {
      where.status = { not: 'COMPLETED' };
      where.dueDate = { lt: new Date() };
    }

    const [total, items] = await Promise.all([
      prisma.trainingAssignment.count({ where }),
      prisma.trainingAssignment.findMany({
        where,
        include: {
          course: {
            select: { id: true, code: true, title: true, category: true, durationMinutes: true, passScorePercent: true },
          },
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, department: true, email: true },
          },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((item: any) => ({
        ...item,
        isOverdue: item.status !== 'COMPLETED' && new Date(item.dueDate) < new Date(),
      })),
    };
  }

  /**
   * Update progress or mark completion of an assignment
   */
  static async updateProgress(params: {
    tenantId: string;
    assignmentId: string;
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    score?: number;
    certificateUrl?: string;
    notes?: string;
  }) {
    const { tenantId, assignmentId, status, score, certificateUrl, notes } = params;

    const assignment = await prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, tenantId },
      include: { course: true },
    });

    if (!assignment) {
      throw new Error('Training assignment not found');
    }

    const updateData: any = {};
    if (notes) updateData.notes = notes;
    if (score !== undefined) updateData.score = score;
    if (certificateUrl) updateData.certificateUrl = certificateUrl;

    if (status) {
      updateData.status = status;
    }

    // Auto-mark completed if score meets pass criteria or explicit completion
    const passThreshold = assignment.course.passScorePercent || 80;
    if (status === 'COMPLETED' || (score !== undefined && score >= passThreshold)) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = assignment.completedAt || new Date();
      if (!certificateUrl && !assignment.certificateUrl) {
        // Generate automatic compliance certificate verification stamp
        updateData.certificateUrl = `https://certificates.hrms.internal/${tenantId}/${assignment.course.code}/${assignment.employeeId}.pdf`;
      }
    } else if (status === 'IN_PROGRESS') {
      updateData.status = 'IN_PROGRESS';
    }

    const updated = await prisma.trainingAssignment.update({
      where: { id: assignment.id },
      data: updateData,
      include: { course: true, employee: true },
    });

    logger.info('training.assignment.progress_updated', {
      tenantId,
      assignmentId,
      status: updated.status,
      score: updated.score,
      completedAt: updated.completedAt,
    });

    return updated;
  }

  /**
   * Send automated training reminder alerts for pending or overdue courses
   */
  static async sendReminders(tenantId: string, courseId?: string) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + 7); // Due within 7 days or overdue

    const where: any = {
      tenantId,
      status: { not: 'COMPLETED' },
      dueDate: { lte: thresholdDate },
    };

    if (courseId) {
      where.courseId = courseId;
    }

    const pendingAssignments = await prisma.trainingAssignment.findMany({
      where,
      include: {
        course: { select: { id: true, code: true, title: true, category: true } },
        employee: { select: { id: true, firstName: true, lastName: true, email: true, department: true } },
      },
    });

    if (pendingAssignments.length === 0) {
      return {
        remindersSent: 0,
        message: 'No pending or overdue assignments requiring reminders.',
        remindedEmployees: [],
      };
    }

    const now = new Date();
    const updatedIds: string[] = [];
    const remindedDetails: Array<{
      employeeName: string;
      email: string;
      courseCode: string;
      courseTitle: string;
      dueDate: Date;
      isOverdue: boolean;
      reminderCount: number;
    }> = [];

    for (const item of pendingAssignments) {
      await prisma.trainingAssignment.update({
        where: { id: item.id },
        data: {
          remindersSentCount: { increment: 1 },
          lastReminderAt: now,
        },
      });

      updatedIds.push(item.id);
      remindedDetails.push({
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
        email: item.employee.email,
        courseCode: item.course.code,
        courseTitle: item.course.title,
        dueDate: item.dueDate,
        isOverdue: item.dueDate < now,
        reminderCount: item.remindersSentCount + 1,
      });
    }

    logger.info('training.reminders.dispatched', {
      tenantId,
      courseId,
      count: updatedIds.length,
    });

    return {
      remindersSent: updatedIds.length,
      message: `Dispatched reminders to ${updatedIds.length} employees with pending statutory courses`,
      remindedEmployees: remindedDetails,
    };
  }

  /**
   * Tenant Compliance Dashboard: Statutory POSH, Safety, and overall course metrics
   */
  static async getComplianceDashboard(tenantId: string) {
    const [totalEmployees, courses, allAssignments] = await Promise.all([
      prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.trainingCourse.findMany({ where: { tenantId, isActive: true } }),
      prisma.trainingAssignment.findMany({
        where: { tenantId },
        include: { course: true },
      }),
    ]);

    const totalAssignments = allAssignments.length;
    const completedAssignments = allAssignments.filter((a: any) => a.status === 'COMPLETED').length;
    const overdueAssignments = allAssignments.filter(
      (a: any) => a.status !== 'COMPLETED' && new Date(a.dueDate) < new Date()
    ).length;

    const overallRate = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 100;

    // Statutory POSH metrics specifically
    const poshAssignments = allAssignments.filter((a: any) => a.course.category === 'POSH');
    const poshCompleted = poshAssignments.filter((a: any) => a.status === 'COMPLETED').length;
    const poshRate = poshAssignments.length > 0 ? Math.round((poshCompleted / poshAssignments.length) * 100) : 100;

    // Safety metrics
    const safetyAssignments = allAssignments.filter((a: any) => a.course.category === 'SAFETY');
    const safetyCompleted = safetyAssignments.filter((a: any) => a.status === 'COMPLETED').length;
    const safetyRate = safetyAssignments.length > 0 ? Math.round((safetyCompleted / safetyAssignments.length) * 100) : 100;

    // Course by course metrics
    const courseBreakdown = courses.map((course: any) => {
      const items = allAssignments.filter((a: any) => a.courseId === course.id);
      const comp = items.filter((a: any) => a.status === 'COMPLETED').length;
      const inProg = items.filter((a: any) => a.status === 'IN_PROGRESS').length;
      const over = items.filter((a: any) => a.status !== 'COMPLETED' && new Date(a.dueDate) < new Date()).length;
      const rate = items.length > 0 ? Math.round((comp / items.length) * 100) : 0;

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        category: course.category,
        isMandatory: course.isMandatory,
        assignedCount: items.length,
        completedCount: comp,
        inProgressCount: inProg,
        overdueCount: over,
        completionRatePercent: rate,
      };
    });

    return {
      totalEmployees,
      totalCourses: courses.length,
      totalAssignments,
      completedAssignments,
      overdueAssignments,
      overallCompletionRatePercent: overallRate,
      statutoryCompliance: {
        posh: {
          category: 'POSH',
          assignedCount: poshAssignments.length,
          completedCount: poshCompleted,
          complianceRatePercent: poshRate,
          compliantStatus: poshRate >= 90 ? 'FULLY_COMPLIANT' : 'ACTION_REQUIRED',
        },
        safety: {
          category: 'SAFETY',
          assignedCount: safetyAssignments.length,
          completedCount: safetyCompleted,
          complianceRatePercent: safetyRate,
          compliantStatus: safetyRate >= 80 ? 'FULLY_COMPLIANT' : 'ACTION_REQUIRED',
        },
      },
      courseBreakdown,
    };
  }
}
