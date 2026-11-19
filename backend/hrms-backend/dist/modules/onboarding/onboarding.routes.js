"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboarding_controller_1 = require("./onboarding.controller");
const auth_1 = require("../../shared/middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/', onboarding_controller_1.OnboardingController.getAll);
router.get('/:id', onboarding_controller_1.OnboardingController.getById);
// HR/Admin only
router.post('/bulk', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.bulkCreate);
router.post('/', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.create);
router.post('/:id/complete', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.complete);
router.put('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.update);
router.patch('/:id/task', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.updateTask);
router.delete('/:id', (0, auth_1.authorize)(['ADMIN', 'HR']), onboarding_controller_1.OnboardingController.delete);
exports.default = router;
//# sourceMappingURL=onboarding.routes.js.map