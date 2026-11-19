const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestEmp() {
  const tenantId = '6a08259b752e15d6a06ec490';
  const orgUnit = await prisma.orgUnit.findFirst({ where: { tenantId, isLeaf: true } });
  const hashed = await bcrypt.hash('password123', 10);

  let user = await prisma.user.findUnique({ where: { email: 'alex.test@hryantra.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'alex.test@hryantra.com',
        password: hashed,
        role: 'EMPLOYEE',
        displayName: 'Alex Test',
        status: 'ACTIVE',
        tenantId,
        orgUnitId: orgUnit ? orgUnit.id : null,
        permissions: {
          tabs: { dashboard: true, attendance: true, leave: true, tasks: true },
          actions: { attendance_punch_self: true, attendance_punch_remote_self: true, leaves_apply: true },
        },
      },
    });
    console.log('✅ Created User:', user.email);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, status: 'ACTIVE' },
    });
    console.log('✅ Updated User password:', user.email);
  }

  let emp = await prisma.employee.findUnique({ where: { email: 'alex.test@hryantra.com' } });
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        employeeId: 'EMP-005',
        firstName: 'Alex',
        lastName: 'Test',
        email: 'alex.test@hryantra.com',
        department: 'Sales',
        designation: 'Sales Executive',
        phone: '+91 9876543210',
        status: 'ACTIVE',
        joiningDate: new Date('2024-01-15'),
        tenantId,
        userId: user.id,
        orgUnitId: orgUnit ? orgUnit.id : null,
      },
    });
    console.log('✅ Created Employee record:', emp.employeeId, emp.firstName);
  } else {
    console.log('✅ Employee record already exists:', emp.employeeId);
  }

  await prisma.$disconnect();
}

createTestEmp().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
