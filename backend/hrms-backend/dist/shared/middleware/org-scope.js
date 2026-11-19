"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgScopeMiddleware = orgScopeMiddleware;
const org_scope_service_1 = require("../org/org-scope.service");
async function orgScopeMiddleware(req, res, next) {
    try {
        const user = req.user;
        if (!user?.id) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        req.orgScope = await (0, org_scope_service_1.resolveOrgScope)({
            id: user.id,
            role: user.role,
            orgUnitId: user.orgUnitId,
            tenantId: user.tenantId,
            employeeId: user.employeeId,
        });
        next();
    }
    catch (error) {
        res.status(500).json({ message: error.message || 'Failed to resolve org scope' });
    }
}
//# sourceMappingURL=org-scope.js.map