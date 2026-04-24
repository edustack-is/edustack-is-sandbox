import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GlobalConfig } from '../database/types';

// Default settings values — used when a key is not yet in DB
const DEFAULTS: Record<string, string> = {
  'security.maxLoginAttempts': '5',
  'security.lockoutMinutes': '15',
  'security.passwordResetExpiry': '60',
  'general.systemName': 'EduStack IS',
};

@Injectable()
export class SystemSettingsService {
  constructor(private readonly db: DatabaseService) {}

  /** Get all settings, merged with defaults */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.db.query<GlobalConfig>(
      'SELECT * FROM "GlobalConfig"',
    );
    const result = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /** Get a single setting by key */
  async get(key: string): Promise<string> {
    const row = await this.db.queryOne<GlobalConfig>(
      'SELECT value FROM "GlobalConfig" WHERE key = ?',
      [key],
    );
    return row?.value ?? DEFAULTS[key] ?? '';
  }

  /** Get a numeric setting */
  async getNumber(key: string, fallback: number): Promise<number> {
    const val = await this.get(key);
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  }

  /** Set one or more settings */
  async setMany(settings: Record<string, string>): Promise<void> {
    await this.db.transaction(async (db) => {
      for (const [key, value] of Object.entries(settings)) {
        const existing = await db.queryOne(
          'SELECT key FROM "GlobalConfig" WHERE key = ?',
          [key],
        );
        if (existing) {
          await db.execute(
            'UPDATE "GlobalConfig" SET value = ?, updatedAt = ? WHERE key = ?',
            [value, new Date().toISOString(), key],
          );
        } else {
          await db.execute(
            'INSERT INTO "GlobalConfig" (key, value, updatedAt) VALUES (?, ?, ?)',
            [key, value, new Date().toISOString()],
          );
        }
      }
    });
  }
}
