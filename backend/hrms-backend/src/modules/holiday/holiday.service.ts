import prisma from '../../shared/prisma';
import { OrgScopeContext } from '../../shared/org/org-scope.service';
import { requireTenantId, tenantWhereFromScope } from '../../shared/tenant/tenant-scope';

export class HolidayService {
  static async getAll(scope: OrgScopeContext, activeOnly: boolean = false) {
    return prisma.holiday.findMany({
      where: {
        ...tenantWhereFromScope(scope),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  static async create(scope: OrgScopeContext, data: any) {
    const tenantId = requireTenantId(scope);
    return prisma.holiday.create({
      data: {
        name: data.name,
        date: new Date(data.date),
        type: data.type,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
        tenantId,
      },
    });
  }

  static async bulkCreate(scope: OrgScopeContext, holidays: any[]) {
    const tenantId = requireTenantId(scope);
    return prisma.holiday.createMany({
      data: holidays.map((h) => ({
        name: h.name,
        date: new Date(h.date),
        type: h.type,
        description: h.description,
        isActive: h.isActive !== undefined ? h.isActive : true,
        tenantId,
      })),
    });
  }

  static async update(scope: OrgScopeContext, id: string, data: any) {
    const existing = await prisma.holiday.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Holiday not found');
    return prisma.holiday.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        tenantId: existing.tenantId,
      },
    });
  }

  static async delete(scope: OrgScopeContext, id: string) {
    const existing = await prisma.holiday.findFirst({
      where: { id, ...tenantWhereFromScope(scope) },
    });
    if (!existing) throw new Error('Holiday not found');
    return prisma.holiday.delete({ where: { id } });
  }

  /**
   * Previews holidays from a source year projected into a target year
   * with weekend conflict flags and existing target year conflict warnings.
   */
  static async previewCopyFromLastYear(scope: OrgScopeContext, sourceYear: number, targetYear: number) {
    const tenantId = requireTenantId(scope);

    const startOfSource = new Date(sourceYear, 0, 1);
    const endOfSource = new Date(sourceYear, 11, 31, 23, 59, 59);

    const sourceHolidays = await prisma.holiday.findMany({
      where: {
        tenantId,
        date: { gte: startOfSource, lte: endOfSource },
      },
      orderBy: { date: 'asc' },
    });

    const startOfTarget = new Date(targetYear, 0, 1);
    const endOfTarget = new Date(targetYear, 11, 31, 23, 59, 59);

    const existingTargetHolidays = await prisma.holiday.findMany({
      where: {
        tenantId,
        date: { gte: startOfTarget, lte: endOfTarget },
      },
    });

    const existingTargetDates = new Set(
      existingTargetHolidays.map((h) => h.date.toISOString().split('T')[0])
    );
    const existingTargetNames = new Set(
      existingTargetHolidays.map((h) => h.name.toLowerCase().trim())
    );

    const preview = sourceHolidays.map((h) => {
      const srcDate = new Date(h.date);
      // Project to target year (handle leap year Feb 29 gracefully if needed)
      let projectedMonth = srcDate.getMonth();
      let projectedDay = srcDate.getDate();
      if (projectedMonth === 1 && projectedDay === 29) {
        const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || targetYear % 400 === 0;
        if (!isLeap) projectedDay = 28;
      }

      const projectedDate = new Date(targetYear, projectedMonth, projectedDay);
      const projectedIso = projectedDate.toISOString().split('T')[0];
      const dayOfWeek = projectedDate.getDay(); // 0 = Sun, 6 = Sat
      const isWeekendConflict = dayOfWeek === 0 || dayOfWeek === 6;
      const alreadyExistsInTarget = existingTargetDates.has(projectedIso) || existingTargetNames.has(h.name.toLowerCase().trim());

      return {
        sourceHolidayId: h.id,
        name: h.name,
        type: h.type || 'Public Holiday',
        description: h.description,
        sourceDate: srcDate.toISOString().split('T')[0],
        sourceDayName: srcDate.toLocaleDateString('en-US', { weekday: 'long' }),
        projectedDate: projectedIso,
        projectedDayName: projectedDate.toLocaleDateString('en-US', { weekday: 'long' }),
        isWeekendConflict,
        alreadyExistsInTarget,
        selectedByDefault: !alreadyExistsInTarget,
      };
    });

    return {
      sourceYear,
      targetYear,
      sourceCount: sourceHolidays.length,
      existingInTargetCount: existingTargetHolidays.length,
      preview,
    };
  }

  /**
   * Executes the bulk copy from source year into target year
   */
  static async copyFromLastYear(
    scope: OrgScopeContext,
    sourceYear: number,
    targetYear: number,
    holidaySelections: { sourceHolidayId: string; targetDate: string; name?: string; type?: string; description?: string }[]
  ) {
    const tenantId = requireTenantId(scope);
    if (!holidaySelections || holidaySelections.length === 0) {
      throw new Error('No holidays selected to copy');
    }

    let copiedCount = 0;
    let skippedCount = 0;
    const created: any[] = [];

    for (const item of holidaySelections) {
      if (!item.targetDate) {
        skippedCount++;
        continue;
      }

      const d = new Date(item.targetDate);
      try {
        const h = await prisma.holiday.upsert({
          where: {
            tenantId_date: {
              tenantId,
              date: d,
            },
          },
          update: {
            name: item.name || 'Holiday',
            type: item.type || 'Public Holiday',
            description: item.description,
            isActive: true,
          },
          create: {
            tenantId,
            date: d,
            name: item.name || 'Holiday',
            type: item.type || 'Public Holiday',
            description: item.description,
            isActive: true,
          },
        });
        created.push(h);
        copiedCount++;
      } catch (err) {
        skippedCount++;
      }
    }

    return {
      success: true,
      sourceYear,
      targetYear,
      copiedCount,
      skippedCount,
      holidays: created,
    };
  }
}
