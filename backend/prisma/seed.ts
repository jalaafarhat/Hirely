import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@hirely.app';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin user already exists');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin123!', 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
      role: Role.ADMIN,
      emailVerified: true,
      preferences: {
        create: {
          workModes: ['REMOTE', 'HYBRID', 'ONSITE'],
          jobTypes: ['FULL_TIME'],
        },
      },
    },
  });
  console.log('Admin user created: admin@hirely.app / Admin123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
