import prisma from '../shared/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const BASE_URL = 'http://localhost:5000/api';

async function testHttpEndpoints() {
  console.log('🌐 Testing Live HTTP Endpoints for Templates & Accrual Engine...\n');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error('No tenant found in DB');

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', tenantId: tenant.id },
  }) || await prisma.user.findFirst();

  if (!admin) throw new Error('No admin user found');

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      tenantId: tenant.id,
      permissions: {
        tabs: {
          settings: true,
          leave: true,
          timeOff: true,
        },
        actions: {
          holidays_manage: true,
          leaves_approve: true,
          leaves_apply: true,
        },
      },
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Test 1: Templates List
  console.log('1️⃣ Testing GET /templates');
  const tplRes = await fetch(`${BASE_URL}/templates`, { headers });
  const tplData = await tplRes.json();
  if (!tplRes.ok || !tplData.success) {
    throw new Error(`GET /templates failed: ${JSON.stringify(tplData)}`);
  }
  console.log(`   ✅ 200 OK: Retrieved ${tplData.data.length} templates`);

  // Test 2: Holiday Copy Preview
  console.log('2️⃣ Testing GET /holidays/copy-preview?fromYear=2025&toYear=2026');
  const holRes = await fetch(`${BASE_URL}/holidays/copy-preview?fromYear=2025&toYear=2026`, { headers });
  const holData = await holRes.json();
  if (!holRes.ok || !holData.success) {
    throw new Error(`GET /holidays/copy-preview failed: ${JSON.stringify(holData)}`);
  }
  console.log(`   ✅ 200 OK: Preview generated with ${holData.data.preview.length} projected holidays`);

  // Test 3: Accrual Plans List
  console.log('3️⃣ Testing GET /leaves/accrual/plans');
  const planRes = await fetch(`${BASE_URL}/leaves/accrual/plans`, { headers });
  const planData = await planRes.json();
  if (!planRes.ok || !planData.success) {
    throw new Error(`GET /leaves/accrual/plans failed: ${JSON.stringify(planData)}`);
  }
  console.log(`   ✅ 200 OK: Found ${planData.data.length} leave accrual group plans`);

  // Test 4: Accrual Preview
  console.log('4️⃣ Testing GET /leaves/accrual/preview');
  const prevRes = await fetch(`${BASE_URL}/leaves/accrual/preview`, { headers });
  const prevData = await prevRes.json();
  if (!prevRes.ok || !prevData.success) {
    throw new Error(`GET /leaves/accrual/preview failed: ${JSON.stringify(prevData)}`);
  }
  const previewItems = prevData.data.items || [];
  console.log(`   ✅ 200 OK: Evaluated ${previewItems.length} employees, credits: ${prevData.data.stats.totalCreditsApplied}d`);

  // Test 5: Year-End Preview
  console.log('5️⃣ Testing GET /leaves/accrual/year-end/preview?cycleYear=2026');
  const yeRes = await fetch(`${BASE_URL}/leaves/accrual/year-end/preview?cycleYear=2026`, { headers });
  const yeData = await yeRes.json();
  if (!yeRes.ok || !yeData.success) {
    throw new Error(`GET /leaves/accrual/year-end/preview failed: ${JSON.stringify(yeData)}`);
  }
  const yeItems = yeData.data.items || [];
  console.log(`   ✅ 200 OK: Evaluated year-end (${yeItems.length} employees), carried: ${yeData.data.stats.totalCarried}d, lapsed: ${yeData.data.stats.totalLapsed}d`);

  // Test 6: Accrual Audit Ledger
  console.log('6️⃣ Testing GET /leaves/accrual/ledger');
  const ledRes = await fetch(`${BASE_URL}/leaves/accrual/ledger`, { headers });
  const ledData = await ledRes.json();
  if (!ledRes.ok || !ledData.success) {
    throw new Error(`GET /leaves/accrual/ledger failed: ${JSON.stringify(ledData)}`);
  }
  console.log(`   ✅ 200 OK: Fetched ${ledData.data.length} audit ledger entries`);

  // Test 7: Template Duplication
  console.log('7️⃣ Testing POST /templates/:id/duplicate');
  const sampleTpl = tplData.data[0];
  const dupRes = await fetch(`${BASE_URL}/templates/${sampleTpl.id}/duplicate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newName: `${sampleTpl.name} (E2E Cloned)`,
      newCode: `${sampleTpl.code}_E2E_${Date.now().toString().slice(-4)}`,
    }),
  });
  const dupData = await dupRes.json();
  if (!dupRes.ok || !dupData.success) {
    throw new Error(`POST /templates/:id/duplicate failed: ${JSON.stringify(dupData)}`);
  }
  console.log(`   ✅ 201 OK: Cloned template into "${dupData.data.name}" (${dupData.data.code})`);

  // Test 8: Leave Encashment Request
  console.log('8️⃣ Testing POST /leaves/accrual/encashment');
  const emp = await prisma.employee.findFirst({ where: { tenantId: tenant.id } });
  if (emp) {
    const encRes = await fetch(`${BASE_URL}/leaves/accrual/encashment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        employeeId: emp.id,
        daysToEncash: 1,
        ratePerDay: 1500,
        reason: 'E2E HTTP Test Encashment',
      }),
    });
    const encData = await encRes.json();
    if (!encRes.ok || !encData.success) {
      throw new Error(`POST /leaves/accrual/encashment failed: ${JSON.stringify(encData)}`);
    }
    console.log(`   ✅ 201 OK: Encashment approved for ${encData.data.daysToEncash}d (₹${encData.data.totalAmount})`);
  }

  console.log('\n🎉 ALL LIVE HTTP ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
}

testHttpEndpoints()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error testing HTTP endpoints:', err);
    process.exit(1);
  });
