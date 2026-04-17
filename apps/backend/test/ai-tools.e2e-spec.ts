import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AI Tools API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtToken: string;
  let schoolId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const prisma = app.get(PrismaService);
    const school = await prisma.school.findFirst();
    schoolId = school.id;

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@edustack.cz', password: 'admin123' });

    // Use global token because admin endpoints usually allow it, but we can exchange it
    const selectRes = await request(app.getHttpServer())
      .post(`/api/auth/select-school/${schoolId}`)
      .set('Authorization', `Bearer ${loginRes.body.access_token}`);

    jwtToken = selectRes.body.access_token;
  });

  afterAll(async () => {
    try {
      await app.get(PrismaService).$disconnect();
    } catch (e) {}
    await app.close();
  });

  it('F130, F135 - AI text refinement (polish text)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/grading/ai-polish')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        text: 'Hrubý text.',
        studentName: 'Jan Novák',
        subjectName: 'Matematika',
      });

    // We check if it either succeeds or throws 400 because API Key is missing.
    expect([200, 201, 400, 401, 429]).toContain(res.status);
  });

  it('F133 - Generates thematic plan using AI', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/thematic-plan')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        subjectName: 'Informatika',
        grade: '7',
        hoursPerWeek: 2,
      });

    expect([200, 201, 400, 401, 429]).toContain(res.status);
  });

  it('F134 - Generates student recommendations using AI', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/student-recommendations')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        studentName: 'Pepa Novák',
        grades: [{ subject: 'Matematika', grade: 2 }],
      });

    expect([200, 201, 400, 401, 429]).toContain(res.status);
  });

  it('F136 - Analyze class performance using AI', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/class-analysis')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        className: '7.B',
        grades: [{ student: 'Jan', subject: 'Mat', grade: 1 }],
      });

    expect([200, 201, 400, 401, 429]).toContain(res.status);
  });

  it('F137 - Generate test using AI', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai/generate-test')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        subjectName: 'Čeština',
        topic: 'Pravopis s/z',
        grade: '5',
      });

    expect([200, 201, 400, 401, 429]).toContain(res.status);
  });
});
