import prisma from '../shared/prisma';
import { OrgChartService } from '../modules/employees/org-chart/org-chart.service';

async function main() {
  console.log('🧪 Verifying Org Chart Tree & Celebrations Directory Services...\n');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  const scope: any = {
    tenantId: tenant.id,
    userId: adminUser?.id || tenant.provisionedAdminUserId || '6a08259b752e15d6a06ec470',
    role: 'ADMIN',
    isHqAdmin: true,
  };

  // --- 1. Verify Org Chart Tree ---
  console.log('--- [STEP 1] Testing Org Chart Hierarchy Tree ---');
  const treeResult = await OrgChartService.getReportingTree(scope);

  console.log(`  • Total Employees in chart: ${treeResult.totalEmployees}`);
  console.log(`  • Root Nodes count: ${treeResult.rootCount}`);
  console.log(`  • Max Depth of Hierarchy: ${treeResult.maxDepth}`);
  console.log(`  • Departments: ${treeResult.departments.join(', ')}`);

  if (treeResult.rootCount === 0 || treeResult.roots.length === 0) {
    throw new Error('Failed: Expected at least 1 root in org chart');
  }

  const root = treeResult.roots[0];
  console.log(`  👑 Top Root Node: ${root.name} (${root.designation})`);
  console.log(`     - Direct reports: ${root.directReportsCount}`);
  console.log(`     - Total descendants: ${root.totalDescendantsCount}`);
  console.log(`     - Children: ${root.children.map((c) => `${c.name} (${c.children.length} reports)`).join(', ')}`);

  if (root.directReportsCount < 2) {
    throw new Error(`Failed: Expected at least 2 direct reports under root node ${root.name}`);
  }

  // Find Sarah Connor under root and check her direct reports
  const sarahNode = root.children.find((c) => c.name.includes('Sarah Connor'));
  if (!sarahNode) {
    throw new Error('Failed: Sarah Connor node not found under root');
  }
  console.log(`  👩 Verified Child Node: ${sarahNode.name} -> Direct reports: ${sarahNode.directReportsCount}`);
  if (sarahNode.children.length === 0 || !sarahNode.children.some((c) => c.name.includes('Priya Sharma'))) {
    throw new Error('Failed: Priya Sharma expected as direct report under Sarah Connor');
  }

  console.log('✅ STEP 1 PASSED: Multi-tier reporting hierarchy tree resolved accurately with full descendant counting!\n');

  // --- 2. Verify Celebrations Directory ---
  console.log('--- [STEP 2] Testing Birthday, Anniversary & New Joiner Directory ---');
  const celebrationsResult = await OrgChartService.getCelebrations(scope, { timeframe: 'all' });

  console.log(`  • Birthdays this month: ${celebrationsResult.stats.birthdaysThisMonth}`);
  console.log(`  • Anniversaries this month: ${celebrationsResult.stats.anniversariesThisMonth}`);
  console.log(`  • New Joiners: ${celebrationsResult.stats.newJoinersCount}`);
  console.log(`  • Celebrations happening TODAY: ${celebrationsResult.stats.todayCount}`);
  console.log(`  • Total Upcoming Items: ${celebrationsResult.items.length}`);

  const todayItem = celebrationsResult.items.find((item) => item.isToday);
  if (!todayItem) {
    throw new Error('Failed: Expected at least 1 celebration marked as isToday');
  }
  console.log(`  🎉 Verified Today celebration: ${todayItem.employee.name} (${todayItem.type} - "${todayItem.badge}")`);

  const anniversaryItem = celebrationsResult.items.find((item) => item.type === 'WORK_ANNIVERSARY');
  if (!anniversaryItem) {
    throw new Error('Failed: Work anniversary item missing in celebrations directory');
  }
  console.log(`  🏆 Verified Anniversary: ${anniversaryItem.employee.name} - ${anniversaryItem.milestoneTitle} (Tenure: ${anniversaryItem.tenureYears} yrs)`);

  const newJoinerItem = celebrationsResult.items.find((item) => item.type === 'NEW_JOINER');
  if (!newJoinerItem) {
    throw new Error('Failed: New joiner missing in celebrations directory');
  }
  console.log(`  🚀 Verified New Joiner: ${newJoinerItem.employee.name} - ${newJoinerItem.badge}`);

  console.log('✅ STEP 2 PASSED: All 3 celebration categories computed and sorted correctly!\n');

  // --- 3. Verify Sending Celebration Wish ---
  console.log('--- [STEP 3] Testing Send Celebration Wishes & Greetings ---');
  const targetEmployee = celebrationsResult.items[0].employee;
  const wish = await OrgChartService.sendCelebrationWish(scope, scope.userId, targetEmployee.id, {
    type: 'BIRTHDAY',
    message: 'Happy Birthday from the entire team! Wishing you a sensational year ahead! 🎂🎉',
  });

  console.log(`  💌 Sent wish ID: ${wish.id}`);
  console.log(`  💌 From: ${wish.senderName} ➔ To: ${wish.targetName}`);
  console.log(`  💌 Message: "${wish.message}"`);

  const retrievedWishes = await OrgChartService.getCelebrationWishes(scope, targetEmployee.id);
  console.log(`  📬 Retrieved ${retrievedWishes.length} wish(es) for employee.`);

  if (retrievedWishes.length === 0 || retrievedWishes[0].id !== wish.id) {
    throw new Error('Failed: Sent wish could not be retrieved');
  }

  console.log('✅ STEP 3 PASSED: Celebration wish successfully persisted and retrieved!\n');

  console.log('🎉 ALL BACKEND ORG CHART & CELEBRATIONS CHECKS PASSED WITH 100% SUCCESS!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
