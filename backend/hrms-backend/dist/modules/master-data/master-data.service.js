"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterDataService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const policy_service_1 = require("../policies/policy.service");
const policy_rules_1 = require("../policies/policy-rules");
class MasterDataService {
    static async getMasterData(tenantId) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA;
        // Fetch tenant employees to compute live counts & lookup values
        const employees = await prisma_1.default.employee.findMany({
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
        const deptCounts = {};
        const desigCounts = {};
        for (const emp of employees) {
            if (emp.department) {
                deptCounts[emp.department.toLowerCase()] = (deptCounts[emp.department.toLowerCase()] || 0) + 1;
            }
            if (emp.designation) {
                desigCounts[emp.designation.toLowerCase()] = (desigCounts[emp.designation.toLowerCase()] || 0) + 1;
            }
        }
        const departments = (masterData.departments || []).map((d) => {
            const count = (deptCounts[d.name.toLowerCase()] || 0) +
                (deptCounts[d.code.toLowerCase()] || 0);
            return { ...d, employeeCount: count };
        });
        const designations = (masterData.designations || []).map((des) => {
            const count = (desigCounts[des.title.toLowerCase()] || 0) +
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
    static async upsertDepartment(tenantId, userId, data) {
        if (!data.name?.trim() || !data.code?.trim()) {
            throw new Error('Department name and code are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
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
            }
            else {
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
        }
        else {
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
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async deleteDepartment(tenantId, userId, id) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
        masterData.departments = (masterData.departments || []).filter((d) => d.id !== id);
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async upsertDesignation(tenantId, userId, data) {
        if (!data.title?.trim() || !data.code?.trim()) {
            throw new Error('Designation title and code are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
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
            }
            else {
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
        }
        else {
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
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async deleteDesignation(tenantId, userId, id) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
        masterData.designations = (masterData.designations || []).filter((d) => d.id !== id);
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async upsertGrade(tenantId, userId, data) {
        if (!data.name?.trim() || !data.code?.trim()) {
            throw new Error('Grade name and code are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
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
            }
            else {
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
        }
        else {
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
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async deleteGrade(tenantId, userId, id) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
        masterData.grades = (masterData.grades || []).filter((g) => g.id !== id);
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async upsertCostCentre(tenantId, userId, data) {
        if (!data.name?.trim() || !data.code?.trim()) {
            throw new Error('Cost Centre name and code are required');
        }
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
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
            }
            else {
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
        }
        else {
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
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
    static async deleteCostCentre(tenantId, userId, id) {
        const rules = await policy_service_1.PolicyService.getActiveRules(tenantId);
        const masterData = { ...(rules.masterData || policy_rules_1.DEFAULT_MASTER_DATA) };
        masterData.costCentres = (masterData.costCentres || []).filter((c) => c.id !== id);
        await policy_service_1.PolicyService.updateActiveRules(tenantId, userId, { masterData });
        return this.getMasterData(tenantId);
    }
}
exports.MasterDataService = MasterDataService;
//# sourceMappingURL=master-data.service.js.map