/**
 * Pinpoints which import crashes startup (ERR_INTERNAL_ASSERTION).
 * Run from backendphase2: node scripts/find-startup-crash.mjs
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function tryImport(label, specifier) {
  process.stdout.write(`  ${label} ... `);
  try {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      const abs = path.join(root, specifier.replace(/^\.\//, ''));
      await import(pathToFileURL(abs).href);
    } else {
      await import(specifier);
    }
    console.log('OK');
    return true;
  } catch (err) {
    console.log('FAIL');
    console.error('\n--- CRASH HERE ---');
    console.error(`Module: ${label}`);
    console.error(`Specifier: ${specifier}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('[find-startup-crash] Node', process.version);
console.log('[find-startup-crash] Scanning imports in server startup order...\n');

console.log('== server.js dependencies ==');
await tryImport('http', 'node:http');
await tryImport('socket.io', 'socket.io');

console.log('\n== app.js (middleware + env) ==');
await tryImport('./src/middleware/error.middleware.js', './src/middleware/error.middleware.js');
await tryImport('./src/middleware/tenant-context.middleware.js', './src/middleware/tenant-context.middleware.js');
await tryImport('./src/middleware/request-logger.middleware.js', './src/middleware/request-logger.middleware.js');
await tryImport('./src/config/env.js', './src/config/env.js');

console.log('\n== app.js routes (alphabetical load order in app.js) ==');
const routes = [
  './src/modules/auth/auth.routes.js',
  './src/modules/user/user.routes.js',
  './src/routes/addCandidate.routes.js',
  './src/modules/candidate/candidate.routes.js',
  './src/modules/client/client.routes.js',
  './src/modules/contact/contact.routes.js',
  './src/modules/job/job.routes.js',
  './src/modules/job/jobPublicApply.controller.js',
  './src/utils/upload.middleware.js',
  './src/modules/files/files.routes.js',
  './src/modules/lead/lead.routes.js',
  './src/modules/agreement/agreement.routes.js',
  './src/modules/kyc/kyc.routes.js',
  './src/modules/pipeline/pipeline.routes.js',
  './src/modules/match/match.routes.js',
  './src/modules/interview/interview.routes.js',
  './src/modules/interview-application/interviewApplication.routes.js',
  './src/modules/placement/placement.routes.js',
  './src/modules/billing/billing.routes.js',
  './src/modules/task/task.routes.js',
  './src/modules/activity/activity.routes.js',
  './src/modules/audit/memberAudit.routes.js',
  './src/modules/inbox/inbox.routes.js',
  './src/modules/report/report.routes.js',
  './src/modules/team/team.routes.js',
  './src/routes/teamRoutes.js',
  './src/routes/teamRequestsRoutes.js',
  './src/routes/crossDepartmentRequestRoutes.js',
  './src/routes/leadConversionRequestRoutes.js',
  './src/modules/role/role.routes.js',
  './src/routes/rolesRoutes.js',
  './src/routes/permissionsRoutes.js',
  './src/modules/department/department.routes.js',
  './src/routes/departmentsRoutes.js',
  './src/routes/scheduledMeetingsRoutes.js',
  './src/routes/calendar.routes.js',
  './src/modules/setting/setting.routes.js',
  './src/modules/setting/org-recruitment.routes.js',
  './src/modules/setting/notification-trigger-templates.routes.js',
  './src/modules/setting/alert-management.routes.js',
  './src/modules/ai/ai.routes.js',
  './src/modules/social/social.routes.js',
  './src/modules/linkedin/linkedin.routes.js',
  './src/modules/oauth/oauth.routes.js',
  './src/modules/integration/integration.routes.js',
  './src/modules/user-communication/user-communication.routes.js',
  './src/modules/twilio-test/twilio-test.routes.js',
  './src/routes/pdfProxy.routes.js',
  './src/routes/resumePreview.routes.js',
  './src/modules/hq/hq.routes.js',
  './src/modules/dashboard/dashboard.routes.js',
  './src/routes/ariaRoutes.js',
  './src/modules/internal/portal-sync.routes.js',
  './src/modules/notification/notification.routes.js',
  './src/modules/pre-screen-assessment/assessment.routes.js',
];

for (const route of routes) {
  await tryImport(route, route);
}

console.log('\n== remaining server.js imports ==');
await tryImport('./src/config/prisma.js', './src/config/prisma.js');
await tryImport('./src/socket/bulkCvSocket.js', './src/socket/bulkCvSocket.js');
await tryImport('./src/modules/session/session.service.js', './src/modules/session/session.service.js');
await tryImport('./src/modules/setting/alert-scheduler.service.js', './src/modules/setting/alert-scheduler.service.js');
await tryImport('./src/app.js', './src/app.js');

console.log('\n[find-startup-crash] All imports succeeded.');
console.log('Start the server with: npm start\n');
