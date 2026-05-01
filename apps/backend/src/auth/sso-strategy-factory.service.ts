import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType, SystemSecret } from '../database/types';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';

@Injectable()
export class SsoStrategyFactoryService implements OnModuleInit {
  private readonly logger = new Logger(SsoStrategyFactoryService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cryptoService: CryptoService,
  ) {}

  async onModuleInit() {
    await this.reloadStrategies();
  }

  async reloadStrategies() {
    this.logger.log('Reloading SSO strategies...');

    let allSsoSecrets: SystemSecret[] = [];
    try {
      allSsoSecrets = await this.db.query<SystemSecret>(
        'SELECT * FROM "SystemSecret" WHERE type = ? AND isActive = 1',
        [SecretType.SSO],
      );
    } catch (err: any) {
      if (err.message?.includes('no such table')) {
        this.logger.warn(
          'SystemSecret table not found. Skipping SSO strategy loading.',
        );
        return;
      }
      throw err;
    }

    const grouped = allSsoSecrets.reduce(
      (acc: Record<string, Record<string, string>>, secret: SystemSecret) => {
        if (!acc[secret.service]) acc[secret.service] = {};
        acc[secret.service][secret.key] = secret.value;
        return acc;
      },
      {} as Record<string, Record<string, string>>,
    );

    for (const [service, keys] of Object.entries(grouped)) {
      try {
        const normalizedService = service.startsWith('sso_')
          ? service.substring(4)
          : service;
        this.registerStrategy(
          normalizedService,
          keys as Record<string, string>,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to register ${service} strategy: ${err.message}`,
        );
      }
    }
  }

  private registerStrategy(service: string, keys: Record<string, string>) {
    const clientId = keys['CLIENT_ID'];
    const encryptedSecret = keys['CLIENT_SECRET'] || keys['PRIVATE_KEY'];

    if (!clientId || !encryptedSecret) {
      this.logger.warn(
        `Skipping ${service} - missing CLIENT_ID or CLIENT_SECRET/PRIVATE_KEY`,
      );
      return;
    }

    const clientSecret = this.cryptoService.decrypt(encryptedSecret);
    const callbackURL = `/api/auth/callback/${service.toLowerCase()}`;

    let strategy: any;

    switch (service.toUpperCase()) {
      case 'GOOGLE':
        strategy = new GoogleStrategy(
          {
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            scope: ['profile', 'email'],
          },
          (
            accessToken: string,
            refreshToken: string,
            profile: any,
            done: any,
          ) => done(null, profile),
        );
        break;

      case 'GITHUB':
        strategy = new GitHubStrategy(
          {
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            scope: ['user:email'],
          },
          (
            accessToken: string,
            refreshToken: string,
            profile: any,
            done: any,
          ) => done(null, profile),
        );
        break;

      case 'MICROSOFT':
        strategy = new MicrosoftStrategy(
          {
            clientID: clientId,
            clientSecret: clientSecret,
            callbackURL: callbackURL,
            tenant: keys['TENANT_ID'] || 'common',
            scope: ['user.read'],
          },
          (
            accessToken: string,
            refreshToken: string,
            profile: any,
            done: any,
          ) => done(null, profile),
        );
        break;

      case 'APPLE': {
        const AppleStrategyModule = require('passport-appleid');
        strategy = new AppleStrategyModule(
          {
            clientID: clientId,
            teamID: keys['TEAM_ID'],
            keyID: keys['KEY_ID'],
            privateKeyString: clientSecret,
            callbackURL: callbackURL,
            scope: ['name', 'email'],
          },
          (
            accessToken: string,
            refreshToken: string,
            idToken: string,
            profile: any,
            done: any,
          ) => done(null, profile),
        );
        break;
      }

      default:
        this.logger.warn(`Unknown SSO service type: ${service}`);
        return;
    }

    if (strategy) {
      passport.use(service.toLowerCase(), strategy);
      this.logger.log(`Registered ${service} strategy.`);
    }
  }
}
