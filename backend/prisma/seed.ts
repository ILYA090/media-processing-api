import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@system.local';

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log('Super admin already exists, skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash('admin', 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Super Admin',
      role: 'OWNER',
      status: 'ACTIVE',
      isSuperAdmin: true,
      organizationId: null,
    },
  });

  console.log('Super admin created: admin@system.local / admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
