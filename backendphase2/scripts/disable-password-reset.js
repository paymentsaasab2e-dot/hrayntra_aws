import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔓 Disabling forced password reset for all users...\n');

  // List of test user emails
  const testUserEmails = [
    'superadmin@saasa.com',
    'admin@saasa.com',
    'senior.recruiter@saasa.com',
    'recruiter@saasa.com',
    'account.manager@saasa.com',
    'finance@saasa.com',
    'viewer@saasa.com',
  ];

  let updatedCount = 0;

  for (const email of testUserEmails) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: { credential: true },
      });

      if (!user) {
        console.log(`  ⚠ User ${email} not found. Skipping...`);
        continue;
      }

      if (!user.credential) {
        console.log(`  ⚠ User ${email} has no credentials. Skipping...`);
        continue;
      }

      // Update credential to disable temp password flag
      await prisma.userCredential.update({
        where: { userId: user.id },
        data: {
          tempPasswordFlag: false,
        },
      });

      console.log(`  ✓ Updated: ${user.firstName} ${user.lastName} (${email})`);
      updatedCount++;
    } catch (error) {
      console.error(`  ✗ Error updating user ${email}:`, error.message);
    }
  }

  console.log(`\n✅ Successfully updated ${updatedCount} users!`);
  console.log('   Users can now log in without being forced to reset password.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
