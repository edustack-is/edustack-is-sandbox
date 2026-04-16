import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dotenv from "dotenv";

import fs from "fs";
import path from "path";

dotenv.config();

let dbPath = process.env.DATABASE_URL?.replace("file:", "");

if (!dbPath) {
    // Look into backend's wrangler folder
    const backendDir = path.resolve(process.cwd(), "../backend");
    const wranglerDir = path.join(backendDir, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
    
    if (fs.existsSync(wranglerDir)) {
        const files = fs.readdirSync(wranglerDir);
        const dbFile = files.find((f: string) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
        if (dbFile) {
            dbPath = path.join(wranglerDir, dbFile);
            console.log(`[MCP] Auto-detected Backend DB: ${dbPath}`);
        }
    }
}

if (!dbPath) {
    dbPath = path.resolve(process.cwd(), "../backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/database.sqlite");
}

const finalPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
console.log(`[MCP] 🚀 Opening database at: ${finalPath}`);

const adapter = new PrismaBetterSqlite3({ url: finalPath });

export const prisma = new PrismaClient({ adapter });
