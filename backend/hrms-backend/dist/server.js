"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const employee_routes_1 = __importDefault(require("./modules/employees/employee.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const leave_routes_1 = __importDefault(require("./modules/leave/leave.routes"));
const task_routes_1 = __importDefault(require("./modules/tasks/task.routes"));
const project_routes_1 = __importDefault(require("./modules/projects/project.routes"));
const holiday_routes_1 = __importDefault(require("./modules/holiday/holiday.routes"));
const asset_routes_1 = __importDefault(require("./modules/assets/asset.routes"));
const document_routes_1 = __importDefault(require("./modules/documents/document.routes"));
const performance_routes_1 = __importDefault(require("./modules/performance/performance.routes"));
const onboarding_routes_1 = __importDefault(require("./modules/onboarding/onboarding.routes"));
const user_routes_1 = __importDefault(require("./modules/users/user.routes"));
const location_routes_1 = __importDefault(require("./modules/locations/location.routes"));
const org_unit_routes_1 = __importDefault(require("./modules/org-units/org-unit.routes"));
const approval_routes_1 = __importDefault(require("./modules/approvals/approval.routes"));
const platform_routes_1 = __importDefault(require("./modules/platform/platform.routes"));
const policy_routes_1 = __importDefault(require("./modules/policies/policy.routes"));
const separation_routes_1 = __importDefault(require("./modules/separation/separation.routes"));
const compensation_routes_1 = __importDefault(require("./modules/compensation/compensation.routes"));
const field_visit_routes_1 = __importDefault(require("./modules/field-visits/field-visit.routes"));
const master_data_routes_1 = __importDefault(require("./modules/master-data/master-data.routes"));
const attendance_service_1 = require("./modules/attendance/attendance.service");
const prisma_1 = __importDefault(require("./shared/prisma"));
const logger_1 = require("./shared/logger");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use((req, res, next) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const start = Date.now();
    const actorId = req.user?.id;
    logger_1.logger.info('http.request.started', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        actorId,
    });
    res.on('finish', () => {
        logger_1.logger.info('http.request.completed', {
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            actorId: req.user?.id,
        });
    });
    next();
});
// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'HRMS Backend is running' });
});
// Modular Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/employees', employee_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/leaves', leave_routes_1.default);
app.use('/api/tasks', task_routes_1.default);
app.use('/api/projects', project_routes_1.default);
app.use('/api/holidays', holiday_routes_1.default);
app.use('/api/assets', asset_routes_1.default);
app.use('/api/documents', document_routes_1.default);
app.use('/api/performance', performance_routes_1.default);
app.use('/api/onboarding', onboarding_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/locations', location_routes_1.default);
app.use('/api/org-units', org_unit_routes_1.default);
app.use('/api/approvals', approval_routes_1.default);
app.use('/api/platform', platform_routes_1.default);
app.use('/api/policies', policy_routes_1.default);
app.use('/api/separation', separation_routes_1.default);
app.use('/api/compensation', compensation_routes_1.default);
app.use('/api/field-visits', field_visit_routes_1.default);
app.use('/api/master-data', master_data_routes_1.default);
app.listen(PORT, () => {
    logger_1.logger.info('server.started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
    });
    // Automated Attendance Daily Closure & Auto-Checkout Background Daemon
    // Periodically scans every 15 minutes to auto-close dangling punches and mark auto-absents
    const CLOSURE_INTERVAL_MS = 15 * 60 * 1000;
    setInterval(async () => {
        try {
            const tenants = await prisma_1.default.tenant.findMany({ select: { id: true } });
            for (const t of tenants) {
                await attendance_service_1.AttendanceService.runDailyAttendanceClosure(t.id).catch((err) => {
                    logger_1.logger.error('scheduler.attendance_closure.failed', { tenantId: t.id, error: err?.message });
                });
            }
        }
        catch (err) {
            logger_1.logger.error('scheduler.attendance_closure.fatal', { error: err?.message });
        }
    }, CLOSURE_INTERVAL_MS);
});
//# sourceMappingURL=server.js.map