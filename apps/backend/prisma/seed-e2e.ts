import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcrypt';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || '../../data/dev.db';
const adapter = new PrismaBetterSqlite3({ url: dbPath });
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
