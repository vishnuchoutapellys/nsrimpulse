import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const bootstrapSchema = z.object({
  id: z.string().trim().min(8).max(40).regex(/^[A-Za-z0-9-]+$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(16).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/)
});

const input = bootstrapSchema.safeParse({
  id: process.env.SUPER_ADMIN_ID,
  email: process.env.SUPER_ADMIN_EMAIL,
  password: process.env.SUPER_ADMIN_PASSWORD
});

if (!input.success) {
  throw new Error('Set SUPER_ADMIN_ID, SUPER_ADMIN_EMAIL, and a 16+ character SUPER_ADMIN_PASSWORD in the environment.');
}

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(input.data.password, 12);
  const user = await prisma.user.create({
    data: {
      adminId: input.data.id.toUpperCase(),
      email: input.data.email.toLowerCase(),
      passwordHash,
      isActive: true,
      roles: { create: { role: 'SUPER_ADMIN' } }
    }
  });
  console.log(`Bootstrapped Super Admin ${user.adminId}. Remove the bootstrap credentials from the environment and secret store.`);
} finally {
  await prisma.$disconnect();
}
