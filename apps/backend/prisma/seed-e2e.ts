import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL || 'postgresql://student:student@localhost:5432/skola_db';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['query', 'warn', 'error'] });

async function main() {
    console.log('Seeding E2E test user...');

    const email = 'admin@edustack.cz';
    const password = 'admin123';
    // Using bcrypt to match auth.service.ts
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            isSystemAdmin: true
        },
        create: {
            email,
            passwordHash: hashedPassword,
            firstName: 'System',
            lastName: 'Admin-E2E',
            isSystemAdmin: true
        },
    });

    console.log(`Seeded E2E user ${user.email} successfully.`);
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
