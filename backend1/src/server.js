const dotenv = require('dotenv');
dotenv.config(); // Load env variables early so they are available to imported modules
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server: SocketServer } = require('socket.io');
const { prisma } = require('./lib/prisma');
const authRoutes = require('./routes/auth.routes');
const cvRoutes = require('./routes/cv.routes');
const profileRoutes = require('./routes/profile.routes');
const resumeEditorRoutes = require('./routes/resume-editor.routes');
const cveditorRoutes = require('./routes/cveditor.routes');
const jobRoutes = require('./routes/job.routes');
const cvAnalysisRoutes = require('./routes/cv-analysis.routes');
const candidateRoutes = require('./routes/candidate.routes');
const applicationRoutes = require('./routes/application.routes');
const aiRoutes = require('./routes/ai.routes');
const lmsRoutes = require('./lms/lms.router');
const lmsAiRoutes = require('./routes/lms-ai.routes');
const mockInterviewRoutes = require('./routes/mock-interview.routes');
const interviewRequestRoutes = require('./routes/interview-request.routes');
const interviewerRoutes = require('./routes/interviewer.routes');
const settingsRoutes = require('./routes/settings.routes');
const notificationRoutes = require('./routes/notification.routes');
const internalRoutes = require('./routes/internal.routes');
const contactImportRoutes = require('./routes/contact-import.routes');
const resumePreviewRoutes = require('./routes/resumePreview.routes');
const employerDemoRoutes = require('./routes/employer-demo.routes');
const publicEventsRoutes = require('./routes/public-events.routes');
const publicCoursesRoutes = require('./routes/public-courses.routes');
const tokenRoutes = require('./routes/token.routes');
const { startInterviewReminderScheduler } = require('./services/interview-reminder.service');
const { registerInterviewRoomSocketHandlers } = require('./realtime/interview-room.socket');

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001,https://www.hryantra.com,https://hryantra.com,https://jobportal-himanshu.vercel.app,https://frontend1-nu-ten.vercel.app';
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || DEFAULT_ALLOWED_ORIGINS)
  .split(',')
  .map(v => v.trim().replace(/^https:https:/i, 'https:'))
  .filter(Boolean);

// Explicitly add our target domain if not already present
const targetVercelDomain = 'https://jobportal-himanshu.vercel.app';
if (!allowedOrigins.includes(targetVercelDomain)) {
  allowedOrigins.push(targetVercelDomain);
}

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (
    allowedOrigins.includes(origin) ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return true;
  }
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === 'hryantra.com' || host.endsWith('.hryantra.com');
  } catch {
    return false;
  }
};

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header)
    if (!origin) return callback(null, true);
    
    console.log(`[CORS DEBUG] Origin: ${origin}`);
    console.log(`[CORS DEBUG] Allowed: ${allowedOrigins.join(', ')}`);

    if (isOriginAllowed(origin)) {
      return callback(null, origin);
    }
    
    console.error(`[CORS ERROR] Blocked: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  exposedHeaders: ['X-Token-Balance', 'X-Tokens-Spent'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check with database connection test
app.get('/health', async (req, res) => {
  try {
    // MongoDB does not support Prisma's $queryRaw, so use a native ping command.
    await prisma.$runCommandRaw({ ping: 1 });
    res.json({ 
      status: 'ok', 
      message: 'Server is running',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check - Database connection failed:', error.message);
    res.status(503).json({ 
      status: 'error', 
      message: 'Server is running but database connection failed',
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cv', cvRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/resume-editor', resumeEditorRoutes);
app.use('/api/cveditor', cveditorRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/cv-analysis', cvAnalysisRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/lms/questions', lmsAiRoutes);
app.use('/api/mock-interview', mockInterviewRoutes);
app.use('/api/interview-requests', interviewRequestRoutes);
app.use('/api/interview-request', interviewRequestRoutes);
app.use('/api/interviewer', interviewerRoutes);
app.use('/api/interviewers', interviewerRoutes);
app.use('/api/lms/interview-requests', interviewRequestRoutes);
app.use('/api/lms/interviewer', interviewerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/contacts/import', contactImportRoutes);
app.use('/api/v1/contacts/import', contactImportRoutes);
app.use('/api/resume-preview', resumePreviewRoutes);
app.use('/api/employers/demo-request', employerDemoRoutes);
app.use('/api/events/public', publicEventsRoutes);
app.use('/api/courses/public', publicCoursesRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/hq-chat', require('./routes/hq-chat.routes'));
app.use('/api/hq', require('./routes/hq.routes'));
app.use('/api/office-gossips', require('./routes/office-gossips.routes'));
app.use('/api/document-download', require('./routes/documentDownload.routes'));
app.use('/api/document-view', require('./routes/documentView.routes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, origin || true);
        return;
      }
      callback(new Error(`Socket CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  },
});

registerInterviewRoomSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📱 Allowed frontend origins: ${allowedOrigins.join(', ')}`);
  console.log('🎥 Interview room signaling ready on Socket.IO');
  startInterviewReminderScheduler();
});
