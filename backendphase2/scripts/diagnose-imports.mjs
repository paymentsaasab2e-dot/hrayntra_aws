/**
 * Find which module crashes startup (ERR_INTERNAL_ASSERTION on some Node versions).
 * Run: node scripts/diagnose-imports.mjs
 */
const modules = [
  './src/config/env.js',
  './src/config/prisma.js',
  './src/middleware/request-logger.middleware.js',
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
  './src/app.js',
  './src/server.js',
];

const root = new URL('../', import.meta.url);

for (const mod of modules) {
  const label = mod.startsWith('.') ? mod : mod;
  process.stdout.write(`import ${label} ... `);
  try {
    await import(new URL(mod, root).href);
    console.log('OK');
  } catch (err) {
    console.log('FAIL');
    console.error(err);
    process.exit(1);
  }
}

console.log('\nAll imports OK');
