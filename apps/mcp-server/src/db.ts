import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "../../data/dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const prisma = new PrismaClient({ adapter });
