import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType, SystemSecret } from '../database/types';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';
import * as crypto from 'crypto';

export interface SsoProviderSettings {
  clientId: string;
  isActive: boolean;
  isConfigured: boolean;
  teamId?: string;
  keyId?: string;
}

export type SsoSettings = Record<string, SsoProviderSettings>;

export class UpsertSsoDto {
  clientId: string;
  clientSecret?: string;
  isActive?: boolean;
  teamId?: string;
  keyId?: string;
}

@Injectable()
export class SystemAdminSsoService {
  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
    private readonly ssoStrategyFactory: SsoStrategyFactoryService,
  ) {}

  async getSsoSettings(): Promise<SsoSettings> {
    const secrets = await this.db.query<SystemSecret>(
      'SELECT * FROM "SystemSecret" WHERE type = ?',
      [SecretType.SSO],
    );

    const providers = ['google', 'github', 'microsoft', 'apple'];
    const result: SsoSettings = {};

    for (const provider of providers) {
      const providerSecrets = secrets.filter(
        (s: SystemSecret) => s.service === provider,
      );
      const clientId = providerSecrets.find(
        (s: SystemSecret) => s.key === 'CLIENT_ID',
      );
      const isActive = providerSecrets.some((s: SystemSecret) => s.isActive);

      result[provider] = {
        clientId: clientId?.value || '',
        isActive,
        isConfigured: providerSecrets.length > 0,
      };

      // Conditionally add Apple fields
      if (provider === 'apple') {
        result[provider].teamId =
          providerSecrets.find((s: SystemSecret) => s.key === 'TEAM_ID')
            ?.value || '';
        result[provider].keyId =
          providerSecrets.find((s: SystemSecret) => s.key === 'KEY_ID')
            ?.value || '';
      }
    }

    return result;
  }

  async upsertSsoProvider(provider: string, data: UpsertSsoDto) {
    const { clientId, clientSecret, isActive, ...extra } = data;

    const secretsToUpsert = [{ key: 'CLIENT_ID', value: clientId }];

    if (clientSecret) {
      secretsToUpsert.push({
        key: provider === 'apple' ? 'PRIVATE_KEY' : 'CLIENT_SECRET',
        value: this.cryptoService.encrypt(clientSecret),
      });
    }

    if (provider === 'apple') {
      if (extra.teamId)
        secretsToUpsert.push({ key: 'TEAM_ID', value: extra.teamId });
      if (extra.keyId)
        secretsToUpsert.push({ key: 'KEY_ID', value: extra.keyId });
    }

    for (const item of secretsToUpsert) {
      await this.db.execute(
        `INSERT INTO "SystemSecret" ("id", "type", "service", "key", "value", "isActive", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT("type", "service", "key") DO UPDATE SET
           "value" = EXCLUDED."value",
           "isActive" = EXCLUDED."isActive",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [
          crypto.randomUUID(),
          SecretType.SSO,
          provider,
          item.key,
          item.value,
          isActive ?? true,
          new Date().toISOString(),
        ],
      );
    }

    // Handle isActive for all secrets of this provider
    if (isActive !== undefined) {
      await this.db.execute(
        'UPDATE "SystemSecret" SET isActive = ?, updatedAt = ? WHERE type = ? AND service = ?',
        [isActive, new Date().toISOString(), SecretType.SSO, provider],
      );
    }

    // Trigger strategy reload
    await this.ssoStrategyFactory.reloadStrategies();

    return this.getSsoSettings();
  }

  async removeSsoProvider(provider: string) {
    await this.db.execute(
      'DELETE FROM "SystemSecret" WHERE type = ? AND service = ?',
      [SecretType.SSO, provider],
    );

    // Trigger strategy reload
    await this.ssoStrategyFactory.reloadStrategies();

    return this.getSsoSettings();
  }
}
