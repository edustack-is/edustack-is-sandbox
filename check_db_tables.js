const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const fs = require('fs');
const path = require('path');

async function check() {
    let dbPath = null;
    const wranglerDir = path.join(process.cwd(), 'apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
    
    console.log(`Checking directory: ${wranglerDir}`);
    
    if (fs.existsSync(wranglerDir)) {
        const files = fs.readdirSync(wranglerDir);
        const dbFile = files.find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
        if (dbFile) {
            dbPath = path.join(wranglerDir, dbFile);
            console.log(`Found hashed DB: ${dbPath}`);
        }
    }

    if (!dbPath) {
        console.error("Could not find D1 database file.");
        return;
    }

    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const prisma = new PrismaClient({ adapter });

    try {
        const secrets = await prisma.systemSecret.findMany();
        console.log(`✅ Success! Found ${secrets.length} secrets in SystemSecret table.`);
    } catch (e) {
        console.error("❌ Error query SystemSecret table:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
