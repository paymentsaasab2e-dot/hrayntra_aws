import { Router } from 'express';
import { authMiddleware, authorize } from '../../shared/middleware/auth';
import { orgScopeMiddleware } from '../../shared/middleware/org-scope';
import { ApprovalController } from './approval.controller';
import { DelegationController } from './delegation/delegation.controller';

const router = Router();

router.use(authMiddleware, orgScopeMiddleware);

// Approval Inbox & Action
router.get('/inbox', authorize(['ADMIN', 'HR', 'MANAGER']), ApprovalController.getInbox);
router.post('/:id/act', authorize(['ADMIN', 'HR', 'MANAGER']), ApprovalController.act);

// Approver Delegation
router.get('/delegations', authorize(['ADMIN', 'HR', 'MANAGER']), DelegationController.list);
router.post('/delegations', authorize(['ADMIN', 'HR', 'MANAGER']), DelegationController.create);
router.delete('/delegations/:id', authorize(['ADMIN', 'HR', 'MANAGER']), DelegationController.revoke);

export default router;
