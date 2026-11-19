"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const field_visit_controller_1 = require("./field-visit.controller");
const auth_1 = require("../../shared/middleware/auth");
const org_scope_1 = require("../../shared/middleware/org-scope");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware, org_scope_1.orgScopeMiddleware);
router.get('/locations', field_visit_controller_1.FieldVisitController.listVisitLocations);
router.get('/roster', field_visit_controller_1.FieldVisitController.listRoster);
router.post('/roster', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), field_visit_controller_1.FieldVisitController.assignRoster);
router.delete('/roster/:id', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), field_visit_controller_1.FieldVisitController.removeAssignment);
router.post('/roster/:id/verify', field_visit_controller_1.FieldVisitController.verifyVisit);
router.post('/roster/:id/missed', (0, auth_1.authorize)(['ADMIN', 'HR', 'MANAGER']), field_visit_controller_1.FieldVisitController.markMissed);
router.get('/mine/today', field_visit_controller_1.FieldVisitController.getMineToday);
router.post('/ping', field_visit_controller_1.FieldVisitController.recordPing);
router.get('/live', field_visit_controller_1.FieldVisitController.getLive);
exports.default = router;
//# sourceMappingURL=field-visit.routes.js.map