import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseError, DatabaseService } from '../database/database.service';
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
      // DatabaseService wraps SqliteError in DatabaseError, so the wrapper's
      // own message is always "Database query failed: ..." and never contains
      // "no such table". Look at the original error to recognise the
      // fresh-DB-before-migrations case (table missing) and skip gracefully.
      // Any other error (e.g. SQLITE_NOTADB) must still bubble — the whole DB
      // is unusable in that case and start.sh's quick_check is the right
      // place to recover, not silent suppression here.
      const innerMessage = String(
        (err instanceof DatabaseError ? err.originalError : err)?.message ?? '',
      );
      if (innerMessage.includes('no such table')) {
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
    // Absolute URL when we know our public origin (BACKEND_PUBLIC_URL is set
    // by deploy-env.yml to https://be-${ENV_NAME}.${DOMAIN}). Otherwise fall
    // back to a relative path and let passport infer the host — fine for
    // local dev, broken behind Fly's TLS proxy without it.
    const publicBase = (process.env.BACKEND_PUBLIC_URL || '').replace(
      /\/$/,
      '',
    );
    const callbackURL = `${publicBase}/api/auth/callback/${service.toLowerCase()}`;

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
        // passport-appleid 1.x is unmaintained and pulls in deprecated
        // `request` + jsonwebtoken@8 (critical/high CVEs). Apple SSO was
        // never wired through to the UI here, so we fail fast with a
        // clear message until a maintained replacement is integrated
        // (e.g. @nicokaiser/passport-apple).
        throw new Error(
          'Apple SSO is temporarily disabled: passport-appleid was dropped ' +
            'for security reasons. Integrate a maintained Apple strategy ' +
            '(e.g. @nicokaiser/passport-apple) before re-enabling.',
        );
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
