import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to script location
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const newPasswordHash = '$2b$10$e8G7/K4w8G40X30tQ6j9a.s3Z6U8z3O3YwWbS/vM5E2XG3X8.O9q2'; // Hash for 'Admin@123'

    const admin = await prisma.user.upsert({
        where: { email: 'admin@nsrimpulse.com' },
        update: {
            passwordHash: newPasswordHash,
            role: 'COLLEGE_ADMIN'
        },
        create: {
            name: 'College Admin',
            email: 'admin@nsrimpulse.com',
            passwordHash: newPasswordHash,
            role: 'COLLEGE_ADMIN'
        }
    });

    console.log('✅ College Admin password successfully reset to: Admin@123');
    console.log('Admin Email:', admin.email);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());