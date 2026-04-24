import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('System Admin Advanced API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as system admin to get token
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@edustack.cz', password: 'admin123' });

    jwtToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    try {
      await app.get(PrismaService).$disconnect();
    } catch (e) {}
    await app.close();
  });

  it('F021 - SSO Configuration: System admin can get and update SSO settings', async () => {
    const getRes = await request(app.getHttpServer())
      .get('/api/system/sso')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('google');
    expect(getRes.body).toHaveProperty('microsoft');

    const putRes = await request(app.getHttpServer())
      .put('/api/system/sso/google')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        clientId: 'test-client-id.apps.googleusercontent.com',
        isActive: false,
      });

    expect(putRes.status).toBe(200);
  });

  it('F026 - Global System Settings: System admin can update global configuration', async () => {
    const putRes = await request(app.getHttpServer())
      .put('/api/system/settings')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        'general.systemName': 'EduStack IS - Test Mode',
      });

    expect(putRes.status).toBe(200);

    const getRes = await request(app.getHttpServer())
      .get('/api/system/settings')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(getRes.body['general.systemName']).toBe('EduStack IS - Test Mode');
  });

  it('F025 - Soft delete schools: System admin can soft delete a school', async () => {
    // Create a temporary school first
    const createRes = await request(app.getHttpServer())
      .post('/api/system/schools')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        schoolName: 'ZŠ K Smazání',
        admin: {
          type: 'NEW',
          firstName: 'Admin',
          lastName: 'Delete',
          email: `delete${Date.now()}@edustack.cz`,
        },
      });

    const newSchoolId = createRes.body.school.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/api/system/schools/${newSchoolId}`)
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toContain('byla úspěšně smazána');
  });

  it('F035, F151 - Audit Logs: Access system audit logs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/system/audit-log')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    // Because we just made a bunch of actions, total should be > 0
    expect(response.body.total).toBeGreaterThan(0);
  });
});
