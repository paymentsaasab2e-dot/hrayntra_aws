import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorMiddleware } from './middleware/error.middleware.js';
import {
  tenantContextMiddleware,
  publicApplyTenantMiddleware,
} from './middleware/tenant-context.middleware.js';
import { requestLoggerMiddleware, responseTimingMiddleware } from './middleware/request-logger.middleware.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/user/user.routes.js';
import addCandidateRouter from './routes/addCandidate.routes.js';
import candidateRoutes from './modules/candidate/candidate.routes.js';
import clientRoutes from './modules/client/client.routes.js';
import contactRoutes from './modules/contact/contact.routes.js';
import jobRoutes from './modules/job/job.routes.js';
import { jobPublicApplyController } from './modules/job/jobPublicApply.controller.js';
import { publicApplyUpload } from './utils/upload.middleware.js';
import filesRoutes from './modules/files/files.routes.js';
import leadRoutes from './modules/lead/lead.routes.js';
import { leadPublicFormController } from './modules/lead/leadPublicForm.controller.js';
import agreementRoutes from './modules/agreement/agreement.routes.js';
import kycRoutes from './modules/kyc/kyc.routes.js';
import pipelineRoutes from './modules/pipeline/pipeline.routes.js';
import matchRoutes from './modules/match/match.routes.js';
import interviewRoutes from './modules/interview/interview.routes.js';
import interviewApplicationRoutes from './modules/interview-application/interviewApplication.routes.js';
import placementRoutes from './modules/placement/placement.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import taskRoutes from './modules/task/task.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import memberAuditRoutes from './modules/audit/memberAudit.routes.js';
import inboxRoutes from './modules/inbox/inbox.routes.js';
import reportRoutes from './modules/report/report.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import teamRoutesNew from './routes/teamRoutes.js';
import teamRequestsRoutes from './routes/teamRequestsRoutes.js';
import crossDepartmentRequestRoutes from './routes/crossDepartmentRequestRoutes.js';
import leadConversionRequestRoutes from './routes/leadConversionRequestRoutes.js';
import roleRoutes from './modules/role/role.routes.js';
import rolesRoutesNew from './routes/rolesRoutes.js';
import permissionsRoutesNew from './routes/permissionsRoutes.js';
import departmentRoutes from './modules/department/department.routes.js';
import departmentsRoutesNew from './routes/departmentsRoutes.js';
import scheduledMeetingsRoutes from './routes/scheduledMeetingsRoutes.js';
import calendarRoutes from './routes/calendar.routes.js';
import settingRoutes from './modules/setting/setting.routes.js';
import orgRecruitmentRoutes from './modules/setting/org-recruitment.routes.js';
import notificationTriggerTemplatesRoutes from './modules/setting/notification-trigger-templates.routes.js';
import alertManagementRoutes from './modules/setting/alert-management.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import brainRoutes from './modules/brain/brain.routes.js';
import socialRoutes from './modules/social/social.routes.js';
import linkedinRoutes from './modules/linkedin/linkedin.routes.js';
import oauthRoutes from './modules/oauth/oauth.routes.js';
import integrationRoutes from './modules/integration/integration.routes.js';
import userCommunicationRoutes from './modules/user-communication/user-communication.routes.js';
import twilioTestRoutes from './modules/twilio-test/twilio-test.routes.js';
import pdfProxyRoutes from './routes/pdfProxy.routes.js';
import publicUploadsRoutes from './routes/publicUploads.routes.js';
import resumePreviewRoutes from './routes/resumePreview.routes.js';
import hqRoutes from './modules/hq/hq.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import portalEventsRoutes from './modules/portal-events/portal-events.routes.js';
import tenantBehaviorRoutes from './modules/tenant-behavior/tenant-behavior.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import ariaRoutes from './routes/ariaRoutes.js';
import portalSyncRoutes from './modules/internal/portal-sync.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import preScreenAssessmentRoutes from './modules/pre-screen-assessment/assessment.routes.js';
import publicLandingRoutes from './modules/public/public.routes.js';

const app = express();

// Behind nginx / Vercel / load balancer — use X-Forwarded-For for real client IP
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  `${env.FRONTEND_URL},http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,https://employers.hryantra.com,https://frontendphase2.vercel.app,https://phase2.hryantra.com,https://hryantra.com`
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server / curl requests without Origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-db-name'],
  exposedHeaders: ['X-Coin-Balance', 'X-Coins-Spent'],
}));
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '15mb';
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use(compression());
app.use(responseTimingMiddleware);
app.use(requestLoggerMiddleware);
app.use(tenantContextMiddleware);
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.path.startsWith('/api/')) return next();
  // Do not mark authenticated / tenant-scoped JSON as publicly cacheable (browser would show stale roles, permissions, etc.)
  const p = req.path;
  if (
    p.startsWith('/api/roles') ||
    p.startsWith('/api/permissions') ||
    p.startsWith('/api/team') ||
    p.startsWith('/api/departments') ||
    p.startsWith('/api/v1/')
  ) {
    return next();
  }
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
});

// Serve static files from uploads directory (one level up from src)
// IMPORTANT: This must be before API routes to avoid conflicts
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Set proper content type for images
    if (filePath.endsWith('.jpeg') || filePath.endsWith('.jpg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (filePath.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.webm')) {
      res.setHeader('Content-Type', 'video/webm');
    } else if (filePath.endsWith('.mov')) {
      res.setHeader('Content-Type', 'video/quicktime');
    } else if (filePath.endsWith('.pdf')) {
      // Default `application/octet-stream` forces a download — the
      // recruiter wants to *view* the offer letter inline, so let the
      // browser's PDF viewer pick it up. `inline` keeps the filename
      // sane if the user does choose to save it.
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  },
}));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API Server is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      tasks: '/api/v1/tasks',
      inbox: '/api/v1/inbox',
      calendar: '/api/v1/calendar',
    },
  });
});

// API root route
app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    message: 'API v1 is available',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      candidates: '/api/v1/candidates',
      clients: '/api/v1/clients',
      jobs: '/api/v1/jobs',
      tasks: '/api/v1/tasks',
      inbox: '/api/v1/inbox',
      interviews: '/api/v1/interviews',
      calendar: '/api/v1/calendar',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug route to test auth routes
app.get('/api/v1/auth/test', (req, res) => {
  res.json({ message: 'Auth routes are working', path: req.path });
});

// API Routes
//
// IMPORTANT: `/api/v1/internal/*` MUST be mounted BEFORE any `/api/v1`
// router that calls `router.use(authMiddleware)` at the router level
// (e.g. `addCandidateRouter`, `scheduledMeetingsRoutes`). Otherwise
// Express runs those routers' router-level JWT auth on every
// `/api/v1/*` request — including the unauthenticated portal-sync
// webhook from backend1 — and rejects with 401 "No token provided"
// before our shared-secret middleware ever sees the request.
app.use('/api/v1/internal', portalSyncRoutes);
// Public document proxies — must be registered before `/api/v1` routers that apply authMiddleware globally
app.use('/api/v1/pdf-proxy', pdfProxyRoutes);
app.use('/api/v1/public/uploads', publicUploadsRoutes);
app.use('/api/v1/resume-preview', resumePreviewRoutes);
app.use('/api/v1/public', publicLandingRoutes);
app.use('/api/v1/auth', authRoutes);
// HQ routes include a public pricing endpoint and must be mounted before
// router-level auth middlewares mounted on generic /api/v1 routers.
app.use('/api/v1/hq', hqRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/portal-events', portalEventsRoutes);
app.use('/api/v1/tenant-behavior', tenantBehaviorRoutes);
// Public job apply — register before any `/api/v1` router with router-level authMiddleware
app.get('/api/v1/jobs/public/apply/:token', jobPublicApplyController.getPublicApplyPage);
app.post(
  '/api/v1/jobs/public/apply/:token/submit',
  publicApplyUpload,
  publicApplyTenantMiddleware,
  jobPublicApplyController.submitPublicApply
);
// Public lead intake form — before auth routers
app.get(
  '/api/v1/leads/public/form/:token',
  publicApplyTenantMiddleware,
  leadPublicFormController.getPublicForm
);
app.get(
  '/api/v1/leads/public/form/:token/submissions',
  publicApplyTenantMiddleware,
  leadPublicFormController.listPublicSubmissions
);
app.post(
  '/api/v1/leads/public/form/:token/submit',
  publicApplyTenantMiddleware,
  leadPublicFormController.submitPublicForm
);
// Public candidate pre-screen sessions — MUST be before addCandidateRouter (router-level auth on /api/v1)
app.use('/api/v1/pre-screen-assessments', preScreenAssessmentRoutes);
// Public interview application forms (Phase 1) — before auth routers
app.use('/api/v1/interview-applications', interviewApplicationRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/linkedin', linkedinRoutes);
app.use('/api/v1/oauth', oauthRoutes);
app.use('/api/v1', integrationRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1', addCandidateRouter);
app.use('/api/v1/candidates', candidateRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/files', filesRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/pipeline', pipelineRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/placements', placementRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/audit', memberAuditRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/team', teamRoutes); // Team members (individual users) - legacy
app.use('/api/team/requests', teamRequestsRoutes);
app.use('/api/cross-dept-requests', crossDepartmentRequestRoutes);
app.use('/api/v1/cross-dept-requests', crossDepartmentRequestRoutes);
app.use('/api/lead-conversion-requests', leadConversionRequestRoutes);
app.use('/api/v1/lead-conversion-requests', leadConversionRequestRoutes);
app.use('/api/team', teamRoutesNew); // New TypeScript team routes
app.use('/api/v1/roles', roleRoutes);
app.use('/api/roles', rolesRoutesNew); // New TypeScript roles routes
app.use('/api/permissions', permissionsRoutesNew); // Permissions route
app.use('/api/v1/permissions', permissionsRoutesNew); // Permissions route alias for proxy/upstream compatibility
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/departments', departmentsRoutesNew); // New TypeScript departments routes
app.use('/api/v1', scheduledMeetingsRoutes); // Scheduled meetings routes
app.use('/api/v1/settings/org', orgRecruitmentRoutes);
app.use('/api/v1/settings/notification-trigger-templates', notificationTriggerTemplatesRoutes);
app.use('/api/v1/settings/alert-management', alertManagementRoutes);
app.use('/api/v1/settings/communication', userCommunicationRoutes);
app.use('/api/v1/settings/twilio', twilioTestRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/ai/aria', ariaRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/brain', brainRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
// (portalSyncRoutes is mounted near the top — before any
// router-level-auth `/api/v1` handlers — see comment above.)
// Removing re-mounts from here as they are now at the top

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error middleware (must be last)
app.use(errorMiddleware);

export default app;
