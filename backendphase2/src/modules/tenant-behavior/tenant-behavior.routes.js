import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { tenantBehaviorController } from './tenant-behavior.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', tenantBehaviorController.upsertSnapshot);
router.get('/engine', tenantBehaviorController.getBehaviorEngine);
router.get('/all', tenantBehaviorController.getAllBehavior);
router.get('/live', tenantBehaviorController.getLiveDashboard);
router.get('/crm-context', tenantBehaviorController.getCrmContext);
router.get('/tenant', tenantBehaviorController.getTenantAggregate);
router.get('/me', tenantBehaviorController.getMySnapshot);
router.get('/', tenantBehaviorController.listSnapshots);
router.get('/user/:userId', tenantBehaviorController.getSnapshotByUser);

export default router;
