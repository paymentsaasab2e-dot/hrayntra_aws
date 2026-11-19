import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import employeeRoutes from './modules/employees/employee.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import leaveRoutes from './modules/leave/leave.routes';
import taskRoutes from './modules/tasks/task.routes';
import projectRoutes from './modules/projects/project.routes';
import holidayRoutes from './modules/holiday/holiday.routes';
import assetRoutes from './modules/assets/asset.routes';
import documentRoutes from './modules/documents/document.routes';
import performanceRoutes from './modules/performance/performance.routes';
import onboardingRoutes from './modules/onboarding/onboarding.routes';
import userRoutes from './modules/users/user.routes';
import locationRoutes from './modules/locations/location.routes';
import orgUnitRoutes from './modules/org-units/org-unit.routes';
import approvalRoutes from './modules/approvals/approval.routes';
import platformRoutes from './modules/platform/platform.routes';
import policyRoutes from './modules/policies/policy.routes';
import separationRoutes from './modules/separation/separation.routes';
import compensationRoutes from './modules/compensation/compensation.routes';
import fieldVisitRoutes from './modules/field-visits/field-visit.routes';
import masterDataRoutes from './modules/master-data/master-data.routes';
import customFieldRoutes from './modules/employees/custom-field.routes';
import templateRoutes from './modules/templates/template.routes';
import complianceRoutes from './modules/compliance/compliance.routes';
import trainingRoutes from './modules/training/training.routes';
import compensationPlanningRoutes from './modules/compensation/planning/compensation-planning.routes';
import talentSuccessionRoutes from './modules/performance/succession/talent-succession.routes';
import workforcePlanningRoutes from './modules/onboarding/workforce/workforce-planning.routes';
import { AttendanceService } from './modules/attendance/attendance.service';
import prisma from './shared/prisma';
import { logger } from './shared/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req: Request, res: Response, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();
  const actorId = (req as any).user?.id;

  logger.info('http.request.started', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    actorId,
  });

  res.on('finish', () => {
    logger.info('http.request.completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      actorId: (req as any).user?.id,
    });
  });

  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'HRMS Backend is running' });
});

// Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/org-units', orgUnitRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/separation', separationRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/field-visits', fieldVisitRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/compensation/planning', compensationPlanningRoutes);
app.use('/api/performance/succession', talentSuccessionRoutes);
app.use('/api/workforce', workforcePlanningRoutes);

app.listen(PORT, () => {
  logger.info('server.started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
  });

  // Automated Attendance Daily Closure & Auto-Checkout Background Daemon
  // Periodically scans every 15 minutes to auto-close dangling punches and mark auto-absents
  const CLOSURE_INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        await AttendanceService.runDailyAttendanceClosure(t.id).catch((err) => {
          logger.error('scheduler.attendance_closure.failed', { tenantId: t.id, error: err?.message });
        });
      }
    } catch (err: any) {
      logger.error('scheduler.attendance_closure.fatal', { error: err?.message });
    }
  }, CLOSURE_INTERVAL_MS);
});
