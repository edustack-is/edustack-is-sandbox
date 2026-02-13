import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

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
}
bootstrap();
