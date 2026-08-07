import express from 'express';
import multer from 'multer';
import { hqController } from './hq.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { portalEventsController } from '../portal-events/portal-events.controller.js';
import {
  PORTAL_EVENT_MEDIA_MAX_BYTES,
  portalEventMediaMulterFilter,
} from '../portal-events/portal-events-media.service.js';
import {
  HQ_COURSE_THUMBNAIL_MAX_BYTES,
  HQ_COURSE_VIDEO_MAX_BYTES,
  courseThumbnailMulterFilter,
  courseVideoMulterFilter,
} from './hq-courses.service.js';

const router = express.Router();

const eventMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PORTAL_EVENT_MEDIA_MAX_BYTES, files: 10 },
  fileFilter: portalEventMediaMulterFilter,
});

const courseThumbnailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HQ_COURSE_THUMBNAIL_MAX_BYTES, files: 1 },
  fileFilter: courseThumbnailMulterFilter,
});

const courseVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HQ_COURSE_VIDEO_MAX_BYTES, files: 1 },
  fileFilter: courseVideoMulterFilter,
});

// Setup initial Super Admin credentials directly
// Note: This is an unsecured setup route intended for bootstrap/initialization.
router.post('/setup', hqController.setupSuperAdmin);

router.post('/provision-tenant', authMiddleware, hqController.provisionTenant);
router.get('/tenants', authMiddleware, hqController.listTenants);
router.put('/tenants/plan', authMiddleware, hqController.assignPlan);
router.put('/tenants/coins', authMiddleware, hqController.setTenantCoins);
router.put('/tenants/pause', authMiddleware, hqController.setTenantPause);
router.put('/tenants/modules', authMiddleware, hqController.updateTenantModules);
router.get('/ai-features', authMiddleware, hqController.listAiFeatures);
router.put('/ai-features', authMiddleware, hqController.updateAiFeatures);
router.get('/ai-coin-packs', authMiddleware, hqController.listAiCoinPacks);
router.put('/ai-coin-packs', authMiddleware, hqController.saveAiCoinPacks);
router.get('/phase1-tokens', authMiddleware, hqController.getPhase1TokenConfig);
router.put('/phase1-tokens/packs', authMiddleware, hqController.savePhase1TokenPacks);
router.put('/phase1-tokens/costs', authMiddleware, hqController.savePhase1TokenCosts);
router.put('/phase1-tokens/earns', authMiddleware, hqController.savePhase1TokenEarns);

router.get('/packages/public', hqController.listPublicPackages);
router.get('/packages', authMiddleware, hqController.listPackages);
router.post('/packages', authMiddleware, hqController.createPackage);
router.put('/packages/:id', authMiddleware, hqController.updatePackage);
router.delete('/packages/:id', authMiddleware, hqController.deletePackage);

// Two delete shapes: body-driven (DELETE /tenants with { email }) and
// URL-driven (DELETE /tenants/:email). The latter is a fallback for HTTP
// clients that strip DELETE bodies.
router.delete('/tenants', authMiddleware, hqController.deleteTenant);
router.delete('/tenants/:email', authMiddleware, hqController.deleteTenant);

router.get('/leads', authMiddleware, hqController.listLeads);
router.post('/leads', authMiddleware, hqController.createLead);
router.put('/leads/:id', authMiddleware, hqController.updateLead);
router.delete('/leads/:id', authMiddleware, hqController.deleteLead);
router.post('/leads/:id/follow-ups', authMiddleware, hqController.addLeadFollowUp);
router.put('/leads/:id/follow-ups/:followUpId', authMiddleware, hqController.updateLeadFollowUp);
router.post('/leads/:id/follow-ups/:followUpId/complete', authMiddleware, hqController.completeLeadFollowUp);
router.delete('/leads/:id/follow-ups/:followUpId', authMiddleware, hqController.deleteLeadFollowUp);
router.post('/leads/:id/remarks', authMiddleware, hqController.addLeadRemark);
router.post('/leads/:id/convert-to-company', authMiddleware, hqController.convertLeadToCompany);

router.get('/demos', authMiddleware, hqController.listDemoRequests);
router.delete('/demos/:id', authMiddleware, hqController.deleteDemoRequest);

router.get('/tickets', authMiddleware, hqController.listSupportTickets);
router.patch('/tickets/:id', authMiddleware, hqController.updateSupportTicket);

router.get('/companies', authMiddleware, hqController.listCompanies);
router.post('/companies', authMiddleware, hqController.createCompany);
router.put('/companies/:id', authMiddleware, hqController.updateCompany);
router.delete('/companies/:id', authMiddleware, hqController.deleteCompany);
router.post('/companies/:id/follow-ups', authMiddleware, hqController.addCompanyFollowUp);
router.put('/companies/:id/follow-ups/:followUpId', authMiddleware, hqController.updateCompanyFollowUp);
router.post('/companies/:id/follow-ups/:followUpId/complete', authMiddleware, hqController.completeCompanyFollowUp);
router.delete('/companies/:id/follow-ups/:followUpId', authMiddleware, hqController.deleteCompanyFollowUp);
router.post('/companies/:id/remarks', authMiddleware, hqController.addCompanyRemark);

router.get('/team', authMiddleware, hqController.listTeamMembers);
router.post('/team', authMiddleware, hqController.createTeamMember);
router.put('/team/:id', authMiddleware, hqController.updateTeamMember);
router.delete('/team/:id', authMiddleware, hqController.deleteTeamMember);

router.get('/permissions', authMiddleware, hqController.listHqPermissions);
router.get('/roles', authMiddleware, hqController.listHqRoles);
router.post('/roles', authMiddleware, hqController.createHqRole);
router.put('/roles/:id', authMiddleware, hqController.updateHqRole);
router.delete('/roles/:id', authMiddleware, hqController.deleteHqRole);

router.get('/portal', authMiddleware, hqController.getPortalOverview);
router.get('/candidates', authMiddleware, hqController.listAllCandidates);
router.get('/tenants/:tenantDbName/behavior', authMiddleware, hqController.getTenantBehavior);
router.get('/candidates/:id/behavior', authMiddleware, hqController.getCandidateBehavior);
router.delete('/portal/jobs/:id', authMiddleware, hqController.deletePortalJob);

router.get('/courses', authMiddleware, hqController.listCourses);
router.post('/courses', authMiddleware, hqController.createCourse);
router.post('/courses/bulk-delete', authMiddleware, hqController.deleteCourses);
router.post(
  '/courses/thumbnail',
  authMiddleware,
  courseThumbnailUpload.single('file'),
  hqController.uploadCourseThumbnail,
);
router.post(
  '/courses/video',
  authMiddleware,
  courseVideoUpload.single('file'),
  hqController.uploadCourseVideo,
);
router.get('/courses/:id/enrollments', authMiddleware, hqController.listCourseEnrollments);
router.put('/courses/:id', authMiddleware, hqController.updateCourse);
router.delete('/courses/:id', authMiddleware, hqController.deleteCourse);

router.get('/analytics', authMiddleware, hqController.getAnalytics);

router.get('/events', authMiddleware, portalEventsController.listHqEvents);
router.post('/events', authMiddleware, portalEventsController.createHqEvent);
router.post('/events/media', authMiddleware, eventMediaUpload.array('files', 10), portalEventsController.uploadHqEventMedia);
router.get('/events/:id/registrations', authMiddleware, portalEventsController.listHqEventRegistrations);
router.put('/events/:id', authMiddleware, portalEventsController.updateHqEvent);
router.post('/events/:id/cancel', authMiddleware, portalEventsController.cancelHqEvent);
router.delete('/events/:id', authMiddleware, portalEventsController.deleteHqEvent);

export default router;
