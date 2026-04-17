import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType } from '@prisma/client';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';

@Injectable()
export class SystemAdminSsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    private readonly ssoStrategyFactory: SsoStrategyFactoryService,
  ) {}

  async getSsoSettings() {
    const secrets = await this.prisma.systemSecret.findMany({
      where: { type: SecretType.SSO },
    });

    const providers = ['google', 'github', 'microsoft', 'apple'];
    const result: any = {};

    for (const provider of providers) {
      const providerSecrets = secrets.filter(
        (s: any) => s.service === provider,
      );
      const clientId = providerSecrets.find((s: any) => s.key === 'CLIENT_ID');
      const isActive = providerSecrets.some((s: any) => s.isActive);

      result[provider] = {
        clientId: clientId?.value || '',
        isActive,
        isConfigured: providerSecrets.length > 0,
      };

      // Conditionally add Apple fields
      if (provider === 'apple') {
        result[provider].teamId =
          providerSecrets.find((s: any) => s.key === 'TEAM_ID')?.value || '';
        result[provider].keyId =
          providerSecrets.find((s: any) => s.key === 'KEY_ID')?.value || '';
      }
    }

    return result;
  }

  async upsertSsoProvider(provider: string, data: any) {
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
      await this.prisma.systemSecret.upsert({
        where: {
          type_service_key: {
            type: SecretType.SSO,
            service: provider,
            key: item.key,
          },
        },
        create: {
          type: SecretType.SSO,
          service: provider,
          key: item.key,
          value: item.value,
          isActive: isActive ?? true,
        },
        update: {
          value: item.value,
          isActive: isActive ?? true,
        },
      });
    }

    // Handle isActive for all secrets of this provider
    if (isActive !== undefined) {
      await this.prisma.systemSecret.updateMany({
        where: { type: SecretType.SSO, service: provider },
        data: { isActive },
      });
    }

    // Trigger strategy reload
    await this.ssoStrategyFactory.reloadStrategies();

    return this.getSsoSettings();
  }
}
