import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const id = 'b1c869d84e75048c5c61c5e3';
const candidate = await prisma.candidate.findUnique({
  where: { id },
  include: { profile: true, resume: true },
});
console.log('candidate', JSON.stringify({
  id: candidate?.id,
  email: candidate?.email,
  firstName: candidate?.firstName,
  lastName: candidate?.lastName,
  isVerified: candidate?.isVerified,
  profileEmail: candidate?.profile?.email,
  profileFullName: candidate?.profile?.fullName,
  profileCity: candidate?.profile?.city,
  profilePhone: candidate?.profile?.phoneNumber,
}, null, 2));

const byEmail = await prisma.candidate.findMany({
  where: {
    OR: [
      { email: { contains: 'rushabh' } },
      { profile: { email: { contains: 'rushabh' } } },
    ],
  },
  select: { id: true, email: true, isVerified: true, profile: { select: { email: true, fullName: true } } },
});
console.log('\nby rushabh email', JSON.stringify(byEmail, null, 2));

await prisma.$disconnect();
