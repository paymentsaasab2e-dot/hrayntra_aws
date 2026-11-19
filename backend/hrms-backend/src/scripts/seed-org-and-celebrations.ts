import prisma from '../shared/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding realistic reporting lines, birthdays, and work anniversaries...');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log('No tenant found.');
    return;
  }

  // Ensure all employees belong to the primary tenant
  await prisma.employee.updateMany({
    data: { tenantId: tenant.id },
  });

  let emps = await prisma.employee.findMany();
  let empByCode = new Map(emps.map((e) => [e.employeeId, e]));

  // Ensure Alex Test (EMP-005) exists
  if (!empByCode.has('EMP-005')) {
    console.log('Creating Alex Test (EMP-005)...');
    const hashedPassword = await bcrypt.hash('Alex@123', 10);
    const alexUser = await prisma.user.upsert({
      where: { email: 'alex.test@hryantra.com' },
      update: {},
      create: {
        email: 'alex.test@hryantra.com',
        password: hashedPassword,
        role: 'EMPLOYEE',
        displayName: 'Alex Test',
        tenantId: tenant.id,
      },
    });

    const alexEmp = await prisma.employee.create({
      data: {
        employeeId: 'EMP-005',
        firstName: 'Alex',
        lastName: 'Test',
        email: 'alex.test@hryantra.com',
        phone: '+1 555-0199',
        designation: 'Sales Executive',
        department: 'Sales',
        joiningDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
        tenantId: tenant.id,
        userId: alexUser.id,
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=faces',
      },
    });

    emps = await prisma.employee.findMany();
    empByCode = new Map(emps.map((e) => [e.employeeId, e]));
  }

  const david = empByCode.get('EMP-003');
  const sarah = empByCode.get('EMP-001');
  const michael = empByCode.get('EMP-002');
  const priya = empByCode.get('EMP-004');
  const alex = empByCode.get('EMP-005');

  if (!david || !sarah || !michael || !priya || !alex) {
    console.log('Employees still missing, aborting seed.');
    return;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  // 1. David Wallace: CFO / Executive Leader (Root)
  // Birthday next month, 6 years tenure
  await prisma.employee.update({
    where: { id: david.id },
    data: {
      reportsToUserId: null,
      dateOfBirth: new Date(1982, (currentMonth + 1) % 12, 18),
      joiningDate: new Date(currentYear - 6, currentMonth, 10),
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
    },
  });

  // 2. Sarah Connor: Lead Engineer (Reports to David)
  // Birthday TODAY! (So celebration "Today! 🎂" badge and Send Wish can be tested instantly!)
  await prisma.employee.update({
    where: { id: sarah.id },
    data: {
      reportsToUserId: david.userId || david.id,
      dateOfBirth: new Date(1993, currentMonth, currentDate),
      joiningDate: new Date(currentYear - 4, (currentMonth + 1) % 12, 1),
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
    },
  });

  // 3. Michael Chang: Product Manager (Reports to David)
  // Work Anniversary in 3 days (3-Year Milestone)
  const annivDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  await prisma.employee.update({
    where: { id: michael.id },
    data: {
      reportsToUserId: david.userId || david.id,
      dateOfBirth: new Date(1990, (currentMonth + 2) % 12, 22),
      joiningDate: new Date(currentYear - 3, annivDate.getMonth(), annivDate.getDate()),
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
    },
  });

  // 4. Priya Sharma: Software Engineer (Reports to Sarah Connor)
  // Birthday in 5 days (Turning 26)
  const priyaBday = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  await prisma.employee.update({
    where: { id: priya.id },
    data: {
      reportsToUserId: sarah.userId || sarah.id,
      dateOfBirth: new Date(1998, priyaBday.getMonth(), priyaBday.getDate()),
      joiningDate: new Date(currentYear - 2, (currentMonth + 3) % 12, 14),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
    },
  });

  // 5. Alex Test: Sales Executive (Reports to Michael Chang)
  // New Joiner! Joined 8 days ago
  const alexJoinDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  await prisma.employee.update({
    where: { id: alex.id },
    data: {
      reportsToUserId: michael.userId || michael.id,
      dateOfBirth: new Date(1996, (currentMonth + 4) % 12, 5),
      joiningDate: alexJoinDate,
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=faces',
    },
  });

  console.log('✅ Successfully seeded reporting tree & celebration milestones:');
  console.log('  👑 David Wallace (Root CFO) -> Sarah Connor & Michael Chang');
  console.log('  👩 Sarah Connor (Reports to David) -> Priya Sharma (Reports to Sarah)');
  console.log('  👨 Michael Chang (Reports to David) -> Alex Test (Reports to Michael)');
  console.log('  🎂 Sarah Connor: Birthday TODAY!');
  console.log('  🏆 Michael Chang: 3-Year Work Anniversary in 3 days!');
  console.log('  🎂 Priya Sharma: Birthday in 5 days!');
  console.log('  🚀 Alex Test: New Joiner (joined 8 days ago)');

  await prisma.$disconnect();
}

main().catch(console.error);
