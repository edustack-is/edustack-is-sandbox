import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { SecretType } from '@prisma/client';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
// NOTE: passport-appleid overwrites OAuth2Strategy.prototype.authenticate globally on require(),
// corrupting ALL OAuth2 strategies. We lazy-load it ONLY in the APPLE case to avoid this.

@Injectable()
export class SsoStrategyFactoryService implements OnModuleInit {
    private readonly logger = new Logger(SsoStrategyFactoryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cryptoService: CryptoService,
    ) { }

    async onModuleInit() {
        await this.reloadStrategies();
    }

    async reloadStrategies() {
        this.logger.log('Reloading SSO strategies...');

        // 1. Fetch all SSO secrets using raw prisma to bypass isolation proxy issues during boot
        const allSsoSecrets = await (this.prisma as any).systemSecret.findMany({
            where: {
                type: SecretType.SSO,
                isActive: true
            },
        });

        // 2. Clear existing dynamic strategies (Passport doesn't have a built-in "unregister", 
        // but we can overwrite by registering again with the same name if needed, 
        // or just accept that they live for the process lifetime if they aren't removed)
        // Note: For a true "dynamic" feel, we should find a way to clear them if they are deactivated.
        // For now, we'll focus on registering current active ones.

        // Group by service
        const grouped = allSsoSecrets.reduce((acc: Record<string, Record<string, string>>, secret: any) => {
            if (!acc[secret.service]) acc[secret.service] = {};
            acc[secret.service][secret.key] = secret.value;
            return acc;
        }, {} as Record<string, Record<string, string>>);

        for (const [service, keys] of Object.entries(grouped)) {
            try {
                this.registerStrategy(service, keys as Record<string, string>);
            } catch (err: any) {
                this.logger.error(`Failed to register ${service} strategy: ${err.message}`);
            }
        }
    }

    private registerStrategy(service: string, keys: Record<string, string>) {
        const clientId = keys['CLIENT_ID'];
        const encryptedSecret = keys['CLIENT_SECRET'] || keys['PRIVATE_KEY']; // Apple uses private key

        if (!clientId || !encryptedSecret) {
            this.logger.warn(`Skipping ${service} - missing CLIENT_ID or CLIENT_SECRET/PRIVATE_KEY`);
            return;
        }

        const clientSecret = this.cryptoService.decrypt(encryptedSecret);
        const callbackURL = `/api/auth/callback/${service.toLowerCase()}`;

        let strategy: any;

        switch (service.toUpperCase()) {
            case 'GOOGLE':
                strategy = new GoogleStrategy({
                    clientID: clientId,
                    clientSecret: clientSecret,
                    callbackURL: callbackURL,
                    scope: ['profile', 'email'],
                }, (accessToken: string, refreshToken: string, profile: any, done: any) => {
                    return done(null, profile);
                });
                break;

            case 'GITHUB':
                strategy = new GitHubStrategy({
                    clientID: clientId,
                    clientSecret: clientSecret,
                    callbackURL: callbackURL,
                    scope: ['user:email'],
                }, (accessToken: string, refreshToken: string, profile: any, done: any) => {
                    return done(null, profile);
                });
                break;

            case 'MICROSOFT':
                strategy = new MicrosoftStrategy({
                    clientID: clientId,
                    clientSecret: clientSecret,
                    callbackURL: callbackURL,
                    tenant: keys['TENANT_ID'] || 'common',
                    scope: ['user.read'],
                }, (accessToken: string, refreshToken: string, profile: any, done: any) => {
                    return done(null, profile);
                });
                break;

            case 'APPLE': {
                // Lazy-load to avoid global OAuth2Strategy.prototype.authenticate override
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const AppleStrategyModule = require('passport-appleid');
                strategy = new AppleStrategyModule({
                    clientID: clientId,
                    teamID: keys['TEAM_ID'],
                    keyID: keys['KEY_ID'],
                    privateKeyString: clientSecret,
                    callbackURL: callbackURL,
                    scope: ['name', 'email'],
                }, (accessToken: string, refreshToken: string, idToken: string, profile: any, done: any) => {
                    return done(null, profile);
                });
                break;
            }

            default:
                this.logger.warn(`Unknown SSO service type: ${service}`);
                return;
        }

        if (strategy) {
            // Register with Passport using the service name (lowercase)
            passport.use(service.toLowerCase(), strategy);
            this.logger.log(`Registered ${service} strategy.`);
        }
    }
}
