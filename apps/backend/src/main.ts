import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { InitService } from './init/init.service';
import { SeedService } from './init/seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
