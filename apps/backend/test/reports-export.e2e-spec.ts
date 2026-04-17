import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Reports and Export API (e2e)', () => {
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

    // Login to get global token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@edustack.cz', password: 'admin123' });

    // Exchange for tenant token
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

  it('F157 - CSI Reports: Should generate Czech School Inspectorate JSON report', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/csi')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('staffing');
  });

  it('F158 - MSMT Reports: Should generate Ministry of Education JSON report', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/reports/msmt')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('summary');
    expect(response.body).toHaveProperty('gradeBreakdown');
  });

  it('F108, F149 - Exports: Should export attendance as CSV', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/export/attendance?format=csv')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text.toLowerCase()).toContain('student'); // Check CSV header
  });
});
