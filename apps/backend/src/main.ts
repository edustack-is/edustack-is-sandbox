import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { InitService } from './init/init.service';
import { SeedService } from './init/seed.service';
import helmet from 'helmet';

async function bootstrap() {
  // ─── Fail-fast: required environment variables ──────────────
  const missingVars: string[] = [];
  if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET       (generate with: openssl rand -base64 64)');
  if (!process.env.ENCRYPTION_KEY) missingVars.push('ENCRYPTION_KEY   (generate with: openssl rand -base64 32)');

  if (missingVars.length > 0) {
    console.error(
      '\n❌  Required environment variables are not set!\n' +
      '    The application cannot start without them.\n\n' +
      missingVars.map(v => `    • ${v}`).join('\n') + '\n\n' +
      '    Add them to your .env file and restart.\n',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // ─── Security headers (Helmet) ─────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // CSP may interfere with Swagger UI
  }));

  // ─── CORS ──────────────────────────────────────────────────────
  // CORS_ORIGIN accepts a single origin or comma-separated list.
  // Examples:
  //   CORS_ORIGIN=https://app.example.com
  //   CORS_ORIGIN=https://app.example.com,https://admin.example.com
  const rawOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = rawOrigin.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-setup-token'],
  });

  // ─── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,               // strip properties not in DTO
    forbidNonWhitelisted: true,    // reject requests with unknown properties
    transform: true,               // auto-transform payloads to DTO instances
  }));

  // Swagger / OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('EduStack IS API')
    .setDescription('Školní informační systém – REST API dokumentace')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('auth', 'Autentizace a pozvánky')
    .addTag('student', 'Studentský modul')
    .addTag('parent', 'Rodičovský modul')
    .addTag('teacher', 'Učitelský modul')
    .addTag('deputy', 'Zástupce školy – administrativa')
    .addTag('principal', 'Ředitel – audit a vedení')
    .addTag('system', 'Systémová administrace')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document);

  await app.listen(process.env.PORT ?? 3000);

  // ─── Auto-seed (docker-compose.demo.yml) ─────────────────────
  if (process.env.AUTO_SEED === 'true') {
    const logger = new Logger('AutoSeed');
    try {
      const initService = app.get(InitService);
      const seedService = app.get(SeedService);

      const status = await initService.getStatus();
      if (!status.initialized) {
        logger.log('AUTO_SEED: System not initialized – running auto-seed...');

        const adminResult = await initService.setup({
          adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@demo.test',
          adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Heslo123!',
          adminFirstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
          adminLastName: process.env.SEED_ADMIN_LAST_NAME || 'Demo',
        });

        const seedResult = await seedService.executeSeed(adminResult.admin.id, {
          filename: process.env.SEED_FILE || 'demo-seed.json',
          overrideAi: {
            geminiApiKey: process.env.GOOGLE_AI_API_KEY,
            openAiApiKey: process.env.OPENAI_API_KEY,
          },
        });

        logger.log(`AUTO_SEED complete: ${seedResult.summary}`);
      } else {
        logger.log('AUTO_SEED: System already initialized – skipping seed.');
      }
    } catch (err) {
      const logger = new Logger('AutoSeed');
      logger.error('AUTO_SEED failed:', err);
    }
  }
}
bootstrap();
