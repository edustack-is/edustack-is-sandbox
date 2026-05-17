import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

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

/**
 * The 16-byte SQLite file format magic: "SQLite format 3" + NUL. Written as
 * hex so the NUL doesn't have to live inside a string literal (tool layers
 * sometimes mangle embedded NULs).
 */
export const SQLITE_MAGIC = Buffer.from(
  '53514c69746520666f726d6174203300',
  'hex',
);

/**
 * Cheap header check — rejects anything that isn't a SQLite file before we
 * even write it to disk. Catches accidental .csv/.json/.gz uploads.
 */
export function hasSqliteMagic(buffer: Buffer): boolean {
  return (
    buffer.length >= SQLITE_MAGIC.length &&
    buffer.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)
  );
}

/**
 * Open the file with better-sqlite3 in readonly mode and run PRAGMA
 * quick_check — forces a real page scan, returns "ok" on a healthy DB.
 * Used to validate uploaded backups before we let them touch the live file.
 */
export function quickCheckSqliteFile(filePath: string): boolean {
  const probe = new Database(filePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const result = probe.pragma('quick_check', { simple: true });
    return result === 'ok';
  } finally {
    probe.close();
  }
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private localDb: Database.Database | null = null;
  private localDbPath: string | null = null;

  constructor(private readonly cls: ClsService) {}

  async onModuleInit() {
    this.localDbPath = this.resolveDatabasePath();
    this.logger.log(`[Database] 📦 Opening local SQLite: ${this.localDbPath}`);
    this.localDb = new Database(this.localDbPath);
  }

  /**
   * Path of the currently-open local SQLite file. Exposed so callers that
   * need to replace the file (e.g. backup restore) can target the same path
   * the service is actually using.
   */
  getLocalDatabasePath(): string | null {
    return this.localDbPath;
  }

  /**
   * Produce a consistent snapshot of the live database at `destPath` using
   * SQLite's online backup API. Safe to call while writes are in flight —
   * unlike fs.copyFileSync, which can yield a torn file with a half-written
   * header (SQLITE_NOTADB on the consumer side) when WAL or any concurrent
   * write is active.
   */
  async backupTo(destPath: string): Promise<void> {
    if (!this.localDb) {
      throw new Error('Cannot back up: local database is not open.');
    }
    await this.localDb.backup(destPath);
  }

  /**
   * Close and reopen the local SQLite connection. Required after the
   * underlying file is replaced on disk (e.g. atomic rename during backup
   * restore) so subsequent queries read from the new inode and not via a
   * stale file handle.
   */
  async reload(): Promise<void> {
    if (this.localDb) {
      try {
        this.localDb.close();
      } catch (err) {
        this.logger.warn(`Failed to close existing DB connection: ${err}`);
      }
      this.localDb = null;
    }
    this.localDbPath = this.resolveDatabasePath();
    this.logger.log(
      `[Database] 🔄 Reopening local SQLite: ${this.localDbPath}`,
    );
    this.localDb = new Database(this.localDbPath);
  }

  private resolveDatabasePath(): string {
    const dbPath = process.env.DATABASE_URL?.replace('file:', '');

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
      const stmt = this.localDb!.prepare(sql);
      return stmt.all(...params) as T[];
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
      const stmt = this.localDb!.prepare(sql);
      return (stmt.get(...params) as T) || null;
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
      const result = this.localDb!.prepare(sql).run(...params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (error) {
      this.logger.error(`Execute failed: ${sql}`, error);
      throw new DatabaseError(
        `Database execute failed: ${sql}`,
        'EXECUTE_ERROR',
        error,
      );
    }
  }

  // In-process mutex so concurrent transaction() calls can't interleave their
  // BEGIN/COMMIT pairs (SQLite allows only one writer at a time anyway, but
  // serializing in JS gives a clean error path).
  private txChain: Promise<unknown> = Promise.resolve();

  /**
   * Execute multiple queries in a transaction. Wraps the callback in
   * BEGIN IMMEDIATE / COMMIT, rolling back on any thrown error. Concurrent
   * calls are serialised through an in-process chain so their BEGIN/COMMIT
   * pairs cannot interleave.
   */
  async transaction<T>(fn: (db: DatabaseService) => Promise<T>): Promise<T> {
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

    const next = this.txChain.then(run, run);
    this.txChain = next.catch(() => {});
    return next;
  }
}
