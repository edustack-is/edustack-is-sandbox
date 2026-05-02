const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function check() {
    let dbPath = null;
    const wranglerDir = path.join(process.cwd(), 'apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

    console.log(`Checking directory: ${wranglerDir}`);

    if (fs.existsSync(wranglerDir)) {
        const files = fs.readdirSync(wranglerDir);
        const dbFile = files.find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
        if (dbFile) {
            dbPath = path.join(wranglerDir, dbFile);
            console.log(`Found hashed DB: ${dbPath}`);
        }
    }

    if (!dbPath) {
        console.error('Could not find D1 database file.');
        return;
    }

    const db = new Database(dbPath);

    try {
        const secrets = db.prepare('SELECT * FROM SystemSecret').all();
        console.log(`✅ Success! Found ${secrets.length} secrets in SystemSecret table.`);
    } catch (e) {
        console.error('❌ Error query SystemSecret table:', e.message);
    } finally {
        db.close();
    }
}

check();
