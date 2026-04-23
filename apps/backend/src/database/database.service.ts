import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

// Minimal D1Database interface for typesafety
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  first<T = unknown>(col?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: any;
  lastRowId?: string | number;
  changes?: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private localDb: Database.Database | null = null;

  constructor(
    private readonly cls: ClsService,
    @Inject('CLOUDFLARE_DB') private readonly d1: D1Database | null,
  ) {}

  async onModuleInit() {
    if (!this.d1) {
      const dbPath = this.resolveDatabasePath();
      this.logger.log(`[Database] 📦 Opening local SQLite: ${dbPath}`);
      this.localDb = new Database(dbPath);
    } else {
      this.logger.log('[Database] ☁️ Using Cloudflare D1');
    }
  }

  private resolveDatabasePath(): string {
    let dbPath = process.env.DATABASE_URL?.replace('file:', '');

    if (!dbPath || !fs.existsSync(dbPath)) {
      let currentPath = process.cwd();
      for (let i = 0; i < 4; i++) {
        const possibleDirs = [
          path.join(
            currentPath,
            'apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
          ),
          path.join(
            currentPath,
            '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
          ),
        ];
        for (const dir of possibleDirs) {
          if (fs.existsSync(dir)) {
            const dbFile = fs
              .readdirSync(dir)
              .find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
            if (dbFile) {
              return path.join(dir, dbFile);
            }
          }
        }
        currentPath = path.join(currentPath, '..');
      }
    }

    if (!dbPath || !fs.existsSync(dbPath)) {
      throw new Error(
        '❌ Database file not found. Please run "npm run db:init" first.',
      );
    }

    return dbPath;
  }

  /**
   * Execute a query and return all results.
   */
  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.d1) {
      const result = await this.d1
        .prepare(sql)
        .bind(...params)
        .all<T>();
      return result.results;
    } else {
      const stmt = this.localDb!.prepare(sql);
      return stmt.all(...params) as T[];
    }
  }

  /**
   * Execute a query that returns a single row.
   */
  async queryOne<T = any>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    if (this.d1) {
      return await this.d1
        .prepare(sql)
        .bind(...params)
        .first<T>();
    } else {
      const stmt = this.localDb!.prepare(sql);
      return (stmt.get(...params) as T) || null;
    }
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE).
   */
  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowid: string | number; changes: number }> {
    if (this.d1) {
      const result = await this.d1
        .prepare(sql)
        .bind(...params)
        .run();
      return {
        lastInsertRowid: result.meta.last_row_id || 0,
        changes: result.meta.changes || 0,
      };
    } else {
      const result = this.localDb!.prepare(sql).run(...params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes,
      };
    }
  }

  /**
   * Execute multiple queries in a transaction.
   * Note: For D1, we use batch() if possible, but for complex logic we might need something else.
   * For now, this is a placeholder for a more robust implementation.
   */
  async transaction<T>(fn: (db: DatabaseService) => Promise<T>): Promise<T> {
    if (this.d1) {
      // D1 doesn't support interactive transactions well in the same way.
      // We would ideally use d1.batch(), but for arbitrary logic we use this for now.
      return await fn(this);
    } else {
      let result: T;
      const runTx = this.localDb!.transaction(() => {
        // This is synchronous in better-sqlite3.
        // We have a problem here because NestJS services are async.
        // We'll have to be careful with this.
      });
      // Simplified for now:
      return await fn(this);
    }
  }
}
