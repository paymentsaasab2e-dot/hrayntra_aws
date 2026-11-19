import prisma from '../../shared/prisma';
import { PolicyService } from '../policies/policy.service';
import {
  DEFAULT_MASTER_DATA,
  DepartmentMaster,
  DesignationMaster,
  GradeMaster,
  CostCentreMaster,
  MasterDataConfig,
} from '../policies/policy-rules';

export class MasterDataService {
  static async getMasterData(tenantId: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = rules.masterData || DEFAULT_MASTER_DATA;

    // Fetch tenant employees to compute live counts & lookup values
    const employees = await prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
      },
    });

    // Compute employee counts
    const deptCounts: Record<string, number> = {};
    const desigCounts: Record<string, number> = {};

    for (const emp of employees) {
      if (emp.department) {
        deptCounts[emp.department.toLowerCase()] = (deptCounts[emp.department.toLowerCase()] || 0) + 1;
      }
      if (emp.designation) {
        desigCounts[emp.designation.toLowerCase()] = (desigCounts[emp.designation.toLowerCase()] || 0) + 1;
      }
    }

    const departments = (masterData.departments || []).map((d) => {
      const count =
        (deptCounts[d.name.toLowerCase()] || 0) +
        (deptCounts[d.code.toLowerCase()] || 0);
      return { ...d, employeeCount: count };
    });

    const designations = (masterData.designations || []).map((des) => {
      const count =
        (desigCounts[des.title.toLowerCase()] || 0) +
        (desigCounts[des.code.toLowerCase()] || 0);
      return { ...des, employeeCount: count };
    });

    const grades = masterData.grades || [];
    const costCentres = masterData.costCentres || [];

    const employeeOptions = employees.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: e.department,
      designation: e.designation,
    }));

    return {
      departments,
      designations,
      grades,
      costCentres,
      totalEmployees: employees.length,
      employeeOptions,
    };
  }

  static async upsertDepartment(tenantId: string, userId: string, data: Partial<DepartmentMaster>) {
    if (!data.name?.trim() || !data.code?.trim()) {
      throw new Error('Department name and code are required');
    }

    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    const departments = [...(masterData.departments || [])];

    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (data.id) {
      const idx = departments.findIndex((d) => d.id === data.id);
      if (idx >= 0) {
        departments[idx] = {
          ...departments[idx],
          ...data,
          code: cleanCode,
          name: cleanName,
        };
      } else {
        departments.push({
          id: data.id,
          code: cleanCode,
          name: cleanName,
          description: data.description?.trim(),
          headEmployeeId: data.headEmployeeId || undefined,
          headEmployeeName: data.headEmployeeName?.trim() || undefined,
          costCenterId: data.costCenterId || undefined,
          status: data.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      departments.push({
        id: `dept_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        name: cleanName,
        description: data.description?.trim(),
        headEmployeeId: data.headEmployeeId || undefined,
        headEmployeeName: data.headEmployeeName?.trim() || undefined,
        costCenterId: data.costCenterId || undefined,
        status: data.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }

    masterData.departments = departments;
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async deleteDepartment(tenantId: string, userId: string, id: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    masterData.departments = (masterData.departments || []).filter((d) => d.id !== id);
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async upsertDesignation(tenantId: string, userId: string, data: Partial<DesignationMaster>) {
    if (!data.title?.trim() || !data.code?.trim()) {
      throw new Error('Designation title and code are required');
    }

    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    const designations = [...(masterData.designations || [])];

    const cleanCode = data.code.trim().toUpperCase();
    const cleanTitle = data.title.trim();

    if (data.id) {
      const idx = designations.findIndex((d) => d.id === data.id);
      if (idx >= 0) {
        designations[idx] = {
          ...designations[idx],
          ...data,
          code: cleanCode,
          title: cleanTitle,
        };
      } else {
        designations.push({
          id: data.id,
          code: cleanCode,
          title: cleanTitle,
          departmentId: data.departmentId || undefined,
          departmentName: data.departmentName?.trim() || undefined,
          gradeId: data.gradeId || undefined,
          gradeCode: data.gradeCode?.trim() || undefined,
          approvalLevel: data.approvalLevel || 'NONE',
          status: data.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      designations.push({
        id: `desig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        title: cleanTitle,
        departmentId: data.departmentId || undefined,
        departmentName: data.departmentName?.trim() || undefined,
        gradeId: data.gradeId || undefined,
        gradeCode: data.gradeCode?.trim() || undefined,
        approvalLevel: data.approvalLevel || 'NONE',
        status: data.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }

    masterData.designations = designations;
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async deleteDesignation(tenantId: string, userId: string, id: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    masterData.designations = (masterData.designations || []).filter((d) => d.id !== id);
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async upsertGrade(tenantId: string, userId: string, data: Partial<GradeMaster>) {
    if (!data.name?.trim() || !data.code?.trim()) {
      throw new Error('Grade name and code are required');
    }

    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    const grades = [...(masterData.grades || [])];

    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (data.id) {
      const idx = grades.findIndex((g) => g.id === data.id);
      if (idx >= 0) {
        grades[idx] = {
          ...grades[idx],
          ...data,
          code: cleanCode,
          name: cleanName,
        };
      } else {
        grades.push({
          id: data.id,
          code: cleanCode,
          name: cleanName,
          minSalary: data.minSalary !== undefined ? Number(data.minSalary) : undefined,
          maxSalary: data.maxSalary !== undefined ? Number(data.maxSalary) : undefined,
          leaveQuota: data.leaveQuota !== undefined ? Number(data.leaveQuota) : undefined,
          noticePeriodDays: data.noticePeriodDays !== undefined ? Number(data.noticePeriodDays) : undefined,
          status: data.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      grades.push({
        id: `grd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        name: cleanName,
        minSalary: data.minSalary !== undefined ? Number(data.minSalary) : undefined,
        maxSalary: data.maxSalary !== undefined ? Number(data.maxSalary) : undefined,
        leaveQuota: data.leaveQuota !== undefined ? Number(data.leaveQuota) : undefined,
        noticePeriodDays: data.noticePeriodDays !== undefined ? Number(data.noticePeriodDays) : undefined,
        status: data.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }

    masterData.grades = grades;
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async deleteGrade(tenantId: string, userId: string, id: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    masterData.grades = (masterData.grades || []).filter((g) => g.id !== id);
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async upsertCostCentre(tenantId: string, userId: string, data: Partial<CostCentreMaster>) {
    if (!data.name?.trim() || !data.code?.trim()) {
      throw new Error('Cost Centre name and code are required');
    }

    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    const costCentres = [...(masterData.costCentres || [])];

    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (data.id) {
      const idx = costCentres.findIndex((c) => c.id === data.id);
      if (idx >= 0) {
        costCentres[idx] = {
          ...costCentres[idx],
          ...data,
          code: cleanCode,
          name: cleanName,
        };
      } else {
        costCentres.push({
          id: data.id,
          code: cleanCode,
          name: cleanName,
          description: data.description?.trim(),
          departmentId: data.departmentId || undefined,
          departmentName: data.departmentName?.trim() || undefined,
          annualBudget: data.annualBudget !== undefined ? Number(data.annualBudget) : undefined,
          currency: data.currency || 'INR',
          status: data.status || 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      costCentres.push({
        id: `cc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        name: cleanName,
        description: data.description?.trim(),
        departmentId: data.departmentId || undefined,
        departmentName: data.departmentName?.trim() || undefined,
        annualBudget: data.annualBudget !== undefined ? Number(data.annualBudget) : undefined,
        currency: data.currency || 'INR',
        status: data.status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      });
    }

    masterData.costCentres = costCentres;
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }

  static async deleteCostCentre(tenantId: string, userId: string, id: string) {
    const rules = await PolicyService.getActiveRules(tenantId);
    const masterData: MasterDataConfig = { ...(rules.masterData || DEFAULT_MASTER_DATA) };
    masterData.costCentres = (masterData.costCentres || []).filter((c) => c.id !== id);
    await PolicyService.updateActiveRules(tenantId, userId, { masterData });
    return this.getMasterData(tenantId);
  }
}
