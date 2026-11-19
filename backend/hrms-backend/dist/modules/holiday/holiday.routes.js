"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const holiday_controller_1 = require("./holiday.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/', holiday_controller_1.HolidayController.getAll);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), holiday_controller_1.HolidayController.create);
router.post('/bulk', (0, auth_1.authorize)(['ADMIN', 'HR']), holiday_controller_1.HolidayController.bulkCreate);
router.patch('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), holiday_controller_1.HolidayController.update);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), holiday_controller_1.HolidayController.delete);
exports.default = router;
//# sourceMappingURL=holiday.routes.js.map