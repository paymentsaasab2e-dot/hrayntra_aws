import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper function to hash password
async function hashPassword(plainText) {
  return await bcrypt.hash(plainText, 10);
}

async function main() {
  console.log('👥 Creating users for each role...\n');

  // Define users for each role
  const usersToCreate = [
    {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@saasa.com',
      roleName: 'Super Admin',
      designation: 'System Administrator',
      departmentName: 'Administration',
      loginId: 'super.admin@saasa',
      password: 'UjvnE3WctAVa',
      userId: '69b6751604a6ae73b0b8f36e',
    },
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@saasa.com',
      roleName: 'Admin',
      designation: 'Administrator',
      departmentName: 'Administration',
      loginId: 'admin.user@saasa',
      password: 'qH2TMY4aQ8FA',
      userId: '69afeeb298aa3e5649a30e45',
    },
    {
      firstName: 'John',
      lastName: 'Recruiter',
      email: 'senior.recruiter@saasa.com',
      roleName: 'Senior Recruiter',
      designation: 'Senior Recruiter',
      departmentName: 'Recruitment',
      loginId: 'john.recruiter@saasa',
      password: 'XwMHRSEkC4Fi',
      userId: '69b6751604a6ae73b0b8f371',
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'recruiter@saasa.com',
      roleName: 'Recruiter',
      designation: 'Recruiter',
      departmentName: 'Recruitment',
      loginId: 'jane.smith@saasa',
      password: 'HwteUggfKSyN',
      userId: '69afeeb298aa3e5649a30e46',
    },
    {
      firstName: 'Mike',
      lastName: 'Manager',
      email: 'account.manager@saasa.com',
      roleName: 'Account Manager',
      designation: 'Account Manager',
      departmentName: 'Sales',
      loginId: 'mike.manager@saasa',
      password: 'XzxisXKafQ6s',
      userId: '69b6751704a6ae73b0b8f374',
    },
    {
      firstName: 'Sarah',
      lastName: 'Finance',
      email: 'finance@saasa.com',
      roleName: 'Finance',
      designation: 'Finance Manager',
      departmentName: 'Finance',
      loginId: 'sarah.finance@saasa',
      password: '2HLqg9xRGXi9',
      userId: '69b6751704a6ae73b0b8f376',
    },
    {
      firstName: 'Viewer',
      lastName: 'User',
      email: 'viewer@saasa.com',
      roleName: 'Viewer',
      designation: 'Viewer',
      departmentName: 'Operations',
      loginId: 'viewer.user@saasa',
      password: 'eTiENJmRHg2j',
      userId: '69b6751704a6ae73b0b8f378',
    },
  ];

  const createdUsers = [];

  for (const userData of usersToCreate) {
    try {
      // Get or create department
      let department = await prisma.department.findFirst({
        where: { name: userData.departmentName },
      });

      if (!department) {
        department = await prisma.department.create({
          data: {
            name: userData.departmentName,
            description: `${userData.departmentName} Department`,
          },
        });
        console.log(`  ✓ Created department: ${userData.departmentName}`);
      }

      // Get role
      const role = await prisma.systemRole.findUnique({
        where: { roleName: userData.roleName },
      });

      if (!role) {
        console.error(`  ✗ Role "${userData.roleName}" not found. Skipping user.`);
        continue;
      }

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      const loginId = userData.loginId;
      const tempPassword = userData.password;
      const hashedPassword = await hashPassword(tempPassword);

      if (user) {
        // If the existing user ID doesn't match USER_CREDENTIALS.md, recreate.
        if (user.id !== userData.userId) {
          console.log(
            `  ⚠ User ${userData.email} exists but userId differs (have=${user.id}, want=${userData.userId}). Recreating...`
          );
          await prisma.user.delete({ where: { id: user.id } });
          user = null;
        } else {
          console.log(`  ⚠ User ${userData.email} already exists. Updating...`);
        }
      }

      if (user) {
        // Update user (keeping the same ID)
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            name: `${userData.firstName} ${userData.lastName}`,
            designation: userData.designation,
            departmentId: department.id,
            roleId: role.id,
            status: 'ACTIVE',
            isActive: true,
            passwordHash: hashedPassword, // for legacy email/password login
          },
        });
      } else {
        // Create user with the exact ID from USER_CREDENTIALS.md
        user = await prisma.user.create({
          data: {
            id: userData.userId,
            firstName: userData.firstName,
            lastName: userData.lastName,
            name: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            designation: userData.designation,
            departmentId: department.id,
            roleId: role.id,
            status: 'ACTIVE',
            isActive: true,
            passwordHash: hashedPassword, // for legacy email/password login
          },
        });
      }

      // Create or update credentials
      const existingCredential = await prisma.userCredential.findUnique({
        where: { userId: user.id },
      });

      if (existingCredential) {
        await prisma.userCredential.update({
          where: { userId: user.id },
          data: {
            loginId,
            hashedPassword,
            // Prompt password change on first login (matches USER_CREDENTIALS.md)
            tempPasswordFlag: true,
            isLocked: false,
            failedAttempts: 0,
          },
        });
      } else {
        await prisma.userCredential.create({
          data: {
            userId: user.id,
            loginId,
            hashedPassword,
            tempPasswordFlag: true,
            isLocked: false,
            failedAttempts: 0,
            createdBy: null,
          },
        });
      }

      createdUsers.push({
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        role: userData.roleName,
        loginId,
        password: tempPassword,
        userId: user.id,
      });

      console.log(`  ✓ Created/Updated: ${userData.firstName} ${userData.lastName} (${userData.roleName})`);
    } catch (error) {
      console.error(`  ✗ Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 USER CREDENTIALS SUMMARY');
  console.log('='.repeat(80));
  console.log('\n');

  createdUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Login ID: ${user.loginId}`);
    console.log(`   Password: ${user.password}`);
    console.log(`   User ID: ${user.userId}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`\n✅ Successfully created/updated ${createdUsers.length} users!\n`);
  console.log('⚠️  IMPORTANT: Save these credentials securely. Passwords are temporary.');
  console.log('   Users will be prompted to change their password on first login.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error creating users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
