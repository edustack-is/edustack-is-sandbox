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

interface D1Meta {
  last_row_id?: string | number | bigint;
  changes?: number;
  [key: string]: unknown;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1Meta;
  lastRowId?: string | number;
  changes?: number;
}

export interface DatabaseQueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  lastInsertRowid?: string | number | bigint;
  changes?: number;
}

/**
 * Custom error class for database operations
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
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
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    try {
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
    } catch (error) {
      this.logger.error(`Query failed: ${sql}`, error);
      throw new DatabaseError(
        `Database query failed: ${sql}`,
        'QUERY_ERROR',
        error,
      );
    }
  }

  /**
   * Execute a query that returns a single row.
   */
  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    try {
      if (this.d1) {
        return await this.d1
          .prepare(sql)
          .bind(...params)
          .first<T>();
      } else {
        const stmt = this.localDb!.prepare(sql);
        return (stmt.get(...params) as T) || null;
      }
    } catch (error) {
      this.logger.error(`QueryOne failed: ${sql}`, error);
      throw new DatabaseError(
        `Database queryOne failed: ${sql}`,
        'QUERY_ONE_ERROR',
        error,
      );
    }
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE).
   */
  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ lastInsertRowid: string | number | bigint; changes: number }> {
    try {
      if (this.d1) {
        const result = await this.dbPrepareAndRun(sql, params);
        return {
          lastInsertRowid:
            (result.meta.last_row_id as string | number | bigint) || 0,
          changes: (result.meta.changes as number) || 0,
        };
      } else {
        const result = this.localDb!.prepare(sql).run(...params);
        return {
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes,
        };
      }
    } catch (error) {
      this.logger.error(`Execute failed: ${sql}`, error);
      throw new DatabaseError(
        `Database execute failed: ${sql}`,
        'EXECUTE_ERROR',
        error,
      );
    }
  }

  private async dbPrepareAndRun(sql: string, params: unknown[]) {
    return await this.d1!.prepare(sql)
      .bind(...params)
      .run();
  }

  // In-process mutex so concurrent transaction() calls can't interleave their
  // BEGIN/COMMIT pairs (SQLite allows only one writer at a time anyway, but
  // serializing in JS gives a clean error path).
  private txChain: Promise<unknown> = Promise.resolve();

  /**
   * Execute multiple queries in a transaction.
   *
   * On local (better-sqlite3): wraps the callback in BEGIN IMMEDIATE / COMMIT,
   * rolling back on any thrown error.
   *
   * On Cloudflare D1: D1 does not support multi-statement transactions through
   * the prepared-statement API used here. The callback runs without atomicity
   * and a warning is logged once per process. To get true atomicity on D1,
   * callers must be refactored to use `d1.batch(...)` with all statements
   * known ahead of time.
   */
  async transaction<T>(fn: (db: DatabaseService) => Promise<T>): Promise<T> {
    if (this.d1) {
      if (!DatabaseService.warnedAboutD1Tx) {
        DatabaseService.warnedAboutD1Tx = true;
        this.logger.warn(
          'transaction() invoked on Cloudflare D1 backend — operations will run ' +
            'sequentially but NOT atomically. Refactor critical write paths to use d1.batch().',
        );
      }
      return await fn(this);
    }

    const run = async (): Promise<T> => {
      await this.execute('BEGIN IMMEDIATE', []);
      try {
        const result = await fn(this);
        await this.execute('COMMIT', []);
        return result;
      } catch (err) {
        try {
          await this.execute('ROLLBACK', []);
        } catch (rollbackErr) {
          this.logger.error(
            'ROLLBACK failed after transaction error',
            rollbackErr,
          );
        }
        throw err;
      }
    };

    // Chain onto the previous tx so they don't interleave.
    const next = this.txChain.then(run, run);
    this.txChain = next.catch(() => {});
    return next;
  }

  private static warnedAboutD1Tx = false;
}
