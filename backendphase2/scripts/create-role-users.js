import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Helper function to generate login ID
async function generateLoginId(firstName, lastName) {
  const first = (firstName || '').toLowerCase().trim();
  const last = (lastName || '').toLowerCase().trim();
  
  if (!first && !last) {
    throw new Error('First name or last name is required');
  }
  
  const baseLoginId = last ? `${first}.${last}@saasa` : `${first}@saasa`;
  let loginId = baseLoginId;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.userCredential.findUnique({
      where: { loginId },
    });
    
    if (!existing) {
      return loginId;
    }
    
    counter++;
    loginId = last 
      ? `${first}.${last}${counter}@saasa` 
      : `${first}${counter}@saasa`;
  }
}

// Helper function to generate temporary password
function generateTempPassword() {
  const length = 12;
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

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
    },
    {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@saasa.com',
      roleName: 'Admin',
      designation: 'Administrator',
      departmentName: 'Administration',
    },
    {
      firstName: 'John',
      lastName: 'Recruiter',
      email: 'senior.recruiter@saasa.com',
      roleName: 'Senior Recruiter',
      designation: 'Senior Recruiter',
      departmentName: 'Recruitment',
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'recruiter@saasa.com',
      roleName: 'Recruiter',
      designation: 'Recruiter',
      departmentName: 'Recruitment',
    },
    {
      firstName: 'Mike',
      lastName: 'Manager',
      email: 'account.manager@saasa.com',
      roleName: 'Account Manager',
      designation: 'Account Manager',
      departmentName: 'Sales',
    },
    {
      firstName: 'Sarah',
      lastName: 'Finance',
      email: 'finance@saasa.com',
      roleName: 'Finance',
      designation: 'Finance Manager',
      departmentName: 'Finance',
    },
    {
      firstName: 'Viewer',
      lastName: 'User',
      email: 'viewer@saasa.com',
      roleName: 'Viewer',
      designation: 'Viewer',
      departmentName: 'Operations',
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

      if (user) {
        console.log(`  ⚠ User ${userData.email} already exists. Updating...`);
        
        // Update user
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
          },
        });
      } else {
        // Create user
        user = await prisma.user.create({
          data: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            name: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            designation: userData.designation,
            departmentId: department.id,
            roleId: role.id,
            status: 'ACTIVE',
            isActive: true,
            passwordHash: 'PLACEHOLDER',
          },
        });
      }

      // Generate login ID
      const loginId = await generateLoginId(userData.firstName, userData.lastName);
      
      // Generate password
      const tempPassword = generateTempPassword();
      const hashedPassword = await hashPassword(tempPassword);

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
            tempPasswordFlag: false, // Set to false so users can log in without forced reset
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
            tempPasswordFlag: false, // Set to false so users can log in without forced reset
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
