import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorMiddleware } from './middleware/error.middleware.js';
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
import filesRoutes from './modules/files/files.routes.js';
import leadRoutes from './modules/lead/lead.routes.js';
import pipelineRoutes from './modules/pipeline/pipeline.routes.js';
import matchRoutes from './modules/match/match.routes.js';
import interviewRoutes from './modules/interview/interview.routes.js';
import placementRoutes from './modules/placement/placement.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import taskRoutes from './modules/task/task.routes.js';
import activityRoutes from './modules/activity/activity.routes.js';
import inboxRoutes from './modules/inbox/inbox.routes.js';
import reportRoutes from './modules/report/report.routes.js';
import teamRoutes from './modules/team/team.routes.js';
import teamRoutesNew from './routes/teamRoutes.js';
import roleRoutes from './modules/role/role.routes.js';
import rolesRoutesNew from './routes/rolesRoutes.js';
import permissionsRoutesNew from './routes/permissionsRoutes.js';
import departmentRoutes from './modules/department/department.routes.js';
import departmentsRoutesNew from './routes/departmentsRoutes.js';
import scheduledMeetingsRoutes from './routes/scheduledMeetingsRoutes.js';
import calendarRoutes from './routes/calendar.routes.js';
import settingRoutes from './modules/setting/setting.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import socialRoutes from './modules/social/social.routes.js';
import linkedinRoutes from './modules/linkedin/linkedin.routes.js';
import oauthRoutes from './modules/oauth/oauth.routes.js';
import integrationRoutes from './modules/integration/integration.routes.js';
import userCommunicationRoutes from './modules/user-communication/user-communication.routes.js';
import twilioTestRoutes from './modules/twilio-test/twilio-test.routes.js';
import pdfProxyRoutes from './routes/pdfProxy.routes.js';

const app = express();

// Middleware
const allowedOrigins = (
  process.env.FRONTEND_URLS ||
  `${env.FRONTEND_URL},http://localhost:3000,http://localhost:3001,https://frontendphase2.vercel.app,https://phase2.saasab2e.com`
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
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
app.use('/api/v1/auth', authRoutes);
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
app.use('/api/v1/pdf-proxy', pdfProxyRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/pipeline', pipelineRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/placements', placementRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/inbox', inboxRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/team', teamRoutes); // Team members (individual users) - legacy
app.use('/api/team', teamRoutesNew); // New TypeScript team routes
app.use('/api/v1/roles', roleRoutes);
app.use('/api/roles', rolesRoutesNew); // New TypeScript roles routes
app.use('/api/permissions', permissionsRoutesNew); // Permissions route
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/departments', departmentsRoutesNew); // New TypeScript departments routes
app.use('/api/v1', scheduledMeetingsRoutes); // Scheduled meetings routes
app.use('/api/v1/settings/communication', userCommunicationRoutes);
app.use('/api/v1/settings/twilio', twilioTestRoutes);
app.use('/api/v1/settings', settingRoutes);
app.use('/api/v1/ai', aiRoutes);
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
