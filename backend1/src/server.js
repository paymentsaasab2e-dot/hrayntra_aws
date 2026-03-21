const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:3000,https://frontend1-nu-ten.vercel.app';
const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || DEFAULT_ALLOWED_ORIGINS)
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📱 Allowed frontend origins: ${allowedOrigins.join(', ')}`);
});
