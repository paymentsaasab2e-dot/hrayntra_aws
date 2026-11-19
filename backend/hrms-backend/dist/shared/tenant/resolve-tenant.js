"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenantId = resolveTenantId;
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Resolve the caller's tenant. Never falls back to "first tenant in DB"
 * (that leaked Client A data to Client B).
 */
async function resolveTenantId(user) {
    if (user.role === 'PLATFORM_OWNER' && !user.tenantId) {
        return null;
    }
    if (user.tenantId) {
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id: user.tenantId },
            select: { id: true },
        });
        return tenant?.id || null;
    }
    if (user.orgUnitId) {
        const ou = await prisma_1.default.orgUnit.findUnique({
            where: { id: user.orgUnitId },
            select: { tenantId: true },
        });
        if (ou?.tenantId)
            return ou.tenantId;
    }
    return null;
}
//# sourceMappingURL=resolve-tenant.js.map