import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dotenv from "dotenv";

import fs from "fs";
import path from "path";

dotenv.config();

let dbPath = process.env.DATABASE_URL?.replace("file:", "");

if (!dbPath) {
    const wranglerDir = "../backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject";
    if (fs.existsSync(wranglerDir)) {
        const files = fs.readdirSync(wranglerDir);
        const dbFile = files.find(f => f.endsWith(".sqlite") && f !== "metadata.sqlite");
        if (dbFile) {
            dbPath = path.join(wranglerDir, dbFile);
        }
    }
}

dbPath = dbPath || "../backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/database.sqlite";
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });
