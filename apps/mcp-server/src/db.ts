import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dotenv from "dotenv";

import fs from "fs";
import path from "path";

// Find and load root .env
const envPaths = [".env", "../../.env"];
for (const p of envPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
        break;
    }
}

let dbPath = process.env.DATABASE_URL?.replace("file:", "");

if (!dbPath) {
    let currentPath = process.cwd();
    // Scan up to 4 levels up to find the backend/wrangler state
    for (let i = 0; i < 4; i++) {
        const checkDir = path.join(currentPath, "apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject");
        const checkDirDirect = path.join(currentPath, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
        
        for (const dir of [checkDir, checkDirDirect]) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                const dbFile = files.find((f: string) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
                if (dbFile) {
                    dbPath = path.join(dir, dbFile);
                    break;
                }
            }
        }
        if (dbPath) break;
        currentPath = path.join(currentPath, "..");
    }
}

if (!dbPath) {
    throw new Error("❌ Wrangler D1 local database not found. Please run 'npm run db:init' from the project root first.");
}

export const databasePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
console.log(`[MCP] 🚀 Opening database at: ${databasePath}`);

const adapter = new PrismaBetterSqlite3({ url: databasePath });

export const prisma = new PrismaClient({ adapter });
