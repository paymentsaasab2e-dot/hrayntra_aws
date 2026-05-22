import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runWithTenantContext, prisma } from '../src/config/prisma.js';
import { candidateService } from '../src/modules/candidate/candidate.service.js';

const base = process.env.DATABASE_URL;
const sofUrl = base.replace(/\/[^/?]+(\?|$)/, '/sof01$1');
const sofPrisma = new PrismaClient({ datasources: { db: { url: sofUrl } } });
const adminUser = await sofPrisma.user.findFirst({
  select: { id: true, email: true, role: true },
});
await sofPrisma.$disconnect();
console.log('adminUser', adminUser);

const mockReq = {
  query: { page: '1', limit: '10', includeCommonPool: 'true' },
  user: {
    id: adminUser?.id,
    role: 'SUPER_ADMIN',
    systemRole: { roleName: 'Super Admin' },
  },
};

await runWithTenantContext('sof01', async () => {
  const result = await candidateService.getAll(mockReq);
  const items = result?.data || result?.items || result;
  const list = Array.isArray(items) ? items : [];
  console.log('total', result?.pagination?.total ?? list.length);
  console.log(
    JSON.stringify(
      list.map((c) => ({
        id: c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        email: c.email,
        source: c.source,
        poolOrigin: c.poolOrigin,
      })),
      null,
      2,
    ),
  );
  const rushabh = list.find((c) => c.id === 'b1c869d84e75048c5c61c5e3' || String(c.email || '').includes('rushabh'));
  console.log('\nrushabh in list?', Boolean(rushabh), rushabh || null);
});
