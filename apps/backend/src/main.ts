import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { InitService } from './init/init.service';
import { SeedService } from './init/seed.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { setupSwagger } from './swagger.setup';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  // ─── Fail-fast: required environment variables ──────────────
  const missingVars: string[] = [];
  const warnings: string[] = [];

  if (!process.env.JWT_SECRET)
    missingVars.push(
      'JWT_SECRET       (generate with: openssl rand -base64 64)',
    );
  if (!process.env.ENCRYPTION_KEY)
    missingVars.push(
      'ENCRYPTION_KEY   (generate with: openssl rand -base64 32)',
    );

  // FRONTEND_URL must be set in production. Without it, every SSO callback
  // and email link silently falls back to http://localhost:5173, which
  // bounces real users off the deployed sandbox the moment they finish
  // Google login.
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
    missingVars.push(
      'FRONTEND_URL     (public URL of the frontend, e.g. https://sandbox.is-edustack.org)',
    );
  }
  // Looser check in dev: warn but don't block.
  if (process.env.NODE_ENV !== 'production' && !process.env.FRONTEND_URL) {
    warnings.push(
      'FRONTEND_URL not set — SSO callbacks and email links will use http://localhost:5173',
    );
  }

  // Validate CORS_ORIGIN format if set
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(',').map((o) => o.trim());
    for (const origin of origins) {
      try {
        new URL(origin);
      } catch {
        warnings.push(`CORS_ORIGIN contains invalid URL: ${origin}`);
      }
    }
  }

  // Warn about missing AI keys in production. GEMINI_API_KEY is accepted as
  // an alias for GOOGLE_AI_API_KEY for compatibility with the MCP server.
  if (process.env.NODE_ENV === 'production') {
    const hasGoogleKey =
      process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!hasGoogleKey && !process.env.OPENAI_API_KEY) {
      warnings.push(
        'No AI API key set (GOOGLE_AI_API_KEY/GEMINI_API_KEY or OPENAI_API_KEY) - AI features will be disabled',
      );
    }
  }

  // Validate NODE_ENV if set
  if (
    process.env.NODE_ENV &&
    !['development', 'production', 'test'].includes(process.env.NODE_ENV)
  ) {
    warnings.push(
      `NODE_ENV should be 'development', 'production', or 'test', got: ${process.env.NODE_ENV}`,
    );
  }

  if (missingVars.length > 0) {
    console.error(
      '\n❌  Required environment variables are not set!\n' +
        '    The application cannot start without them.\n\n' +
        missingVars.map((v) => `    • ${v}`).join('\n') +
        '\n\n' +
        '    Add them to your .env file and restart.\n',
    );
    process.exit(1);
  }

  // Log warnings but don't fail
  if (warnings.length > 0) {
    console.warn(
      '\n⚠️  Environment Warnings:\n' +
        warnings.map((w) => `    • ${w}`).join('\n') +
        '\n',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ─── Trust the upstream proxy (Fly's TLS terminator) ───────────
  // Without this, req.protocol stays "http" behind Fly, and Passport's
  // OAuth strategies build callback URLs as http://be-…/api/auth/callback/…
  // which Google rejects with redirect_uri_mismatch. "1" trusts a single
  // hop (Fly's edge), which is exactly our topology.
  app.set('trust proxy', 1);

  // ─── Security headers (Helmet) ─────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  'https://fonts.googleapis.com',
                ],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
              },
            }
          : false, // Disable in dev — Swagger UI and Vite HMR need inline scripts
    }),
  );

  // ─── CORS ──────────────────────────────────────────────────────
  // CORS_ORIGIN accepts a single origin or comma-separated list.
  // Examples:
  //   CORS_ORIGIN=https://app.example.com
  //   CORS_ORIGIN=https://app.example.com,https://admin.example.com
  const rawOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = rawOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-setup-token'],
  });

  // ─── Cookie parsing ────────────────────────────────────────────
  // Required so the JWT strategy can pull the session token out of the
  // httpOnly cookie that login/select-school/etc. set.
  app.use(cookieParser());

  // ─── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in DTO
      forbidNonWhitelisted: true, // reject requests with unknown properties
      transform: true, // auto-transform payloads to DTO instances
    }),
  );

  // ─── Global exception filter ────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Request logging middleware ────────────────────────────
  app.use(new RequestLoggingMiddleware().use);

  // ─── Swagger / OpenAPI (no-op in production) ────────────────────
  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
  const logger = new Logger('Bootstrap');
  logger.log(`Backend API is running on: http://${host}:${port}`);

  // ─── Auto-seed ──────────────────────────────────────────────
  // AUTO_SEED creates a demo admin and populates fixtures on first boot.
  // It is gated only by AUTO_SEED=true — the deploy workflow exposes this as
  // a checkbox per environment, so the operator opting in is the gate.
  //
  // Caveats (do not enable on a real production tenant):
  //   - It creates a known-password admin account.
  //   - With multiple instances booting in parallel, two processes can both
  //     observe `initialized=false` and race on setup(). The loser hits a
  //     unique-constraint violation and we surface that as "already
  //     initialized — skipping" rather than crashing.
  if (process.env.AUTO_SEED === 'true') {
    const logger = new Logger('AutoSeed');
    try {
      const initService = app.get(InitService);
      const seedService = app.get(SeedService);

      const status = await initService.getStatus();
      if (status.initialized) {
        logger.log('AUTO_SEED: System already initialized – skipping seed.');
      } else {
        logger.log('AUTO_SEED: System not initialized – running auto-seed...');

        let adminResult;
        try {
          adminResult = await initService.setup({
            adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@demo.test',
            adminPassword:
              process.env.SEED_ADMIN_PASSWORD ||
              process.env.DEMO_PASSWORD ||
              'Demo1234!',
            adminFirstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
            adminLastName: process.env.SEED_ADMIN_LAST_NAME || 'Demo',
          });
        } catch (setupErr: any) {
          // Lost the race against another booting instance — bail cleanly.
          const recheck = await initService.getStatus();
          if (recheck.initialized) {
            logger.log(
              'AUTO_SEED: Another process completed setup first – skipping.',
            );
            return;
          }
          throw setupErr;
        }

        const seedResult = await seedService.executeSeed(adminResult.admin.id, {
          filename: process.env.SEED_FILE || 'demo-seed.json',
          overrideAi: {
            geminiApiKey:
              process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
            openAiApiKey: process.env.OPENAI_API_KEY,
          },
        });

        logger.log(`AUTO_SEED complete: ${seedResult.summary}`);
      }
    } catch (err) {
      logger.error('AUTO_SEED failed:', err);
    }
  }
}
bootstrap();
