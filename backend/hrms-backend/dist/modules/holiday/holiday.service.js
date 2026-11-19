"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayService = void 0;
const prisma_1 = __importDefault(require("../../shared/prisma"));
const tenant_scope_1 = require("../../shared/tenant/tenant-scope");
class HolidayService {
    static async getAll(scope, activeOnly = false) {
        return prisma_1.default.holiday.findMany({
            where: {
                ...(0, tenant_scope_1.tenantWhereFromScope)(scope),
                ...(activeOnly ? { isActive: true } : {}),
            },
            orderBy: { date: 'asc' },
        });
    }
    static async create(scope, data) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        return prisma_1.default.holiday.create({
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
    static async bulkCreate(scope, holidays) {
        const tenantId = (0, tenant_scope_1.requireTenantId)(scope);
        return prisma_1.default.holiday.createMany({
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
    static async update(scope, id, data) {
        const existing = await prisma_1.default.holiday.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Holiday not found');
        return prisma_1.default.holiday.update({
            where: { id },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
                tenantId: existing.tenantId,
            },
        });
    }
    static async delete(scope, id) {
        const existing = await prisma_1.default.holiday.findFirst({
            where: { id, ...(0, tenant_scope_1.tenantWhereFromScope)(scope) },
        });
        if (!existing)
            throw new Error('Holiday not found');
        return prisma_1.default.holiday.delete({ where: { id } });
    }
}
exports.HolidayService = HolidayService;
//# sourceMappingURL=holiday.service.js.map