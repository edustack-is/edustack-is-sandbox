import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Default settings values — used when a key is not yet in DB
const DEFAULTS: Record<string, string> = {
  'security.maxLoginAttempts': '5',
  'security.lockoutMinutes': '15',
  'security.passwordResetExpiry': '60',
  'general.systemName': 'EduStack IS',
};

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get all settings, merged with defaults */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.globalConfig.findMany();
    const result = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /** Get a single setting by key */
  async get(key: string): Promise<string> {
    const row = await this.prisma.globalConfig.findUnique({ where: { key } });
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
    const ops = Object.entries(settings).map(([key, value]) =>
      this.prisma.globalConfig.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    );
    await this.prisma.$transaction(ops);
  }
}
