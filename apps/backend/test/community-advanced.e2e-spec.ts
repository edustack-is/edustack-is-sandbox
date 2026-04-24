import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Community Features API (e2e)', () => {
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

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@edustack.cz', password: 'admin123' });

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

  it('F121 - Calendar & RSVP: Create a community calendar event', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/community/events')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        title: 'Školní ples E2E',
        description: 'Událost pro e2e testy',
        startDate: new Date().toISOString(),
        location: 'Tělocvična',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('id');
    const eventId = createRes.body.id;

    // F121 - RSVP handling
    const rsvpRes = await request(app.getHttpServer())
      .post(`/api/community/events/${eventId}/rsvp`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        status: 'YES',
      });

    expect([200, 201]).toContain(rsvpRes.status);

    // Delete the event after test
    await request(app.getHttpServer())
      .delete(`/api/community/events/${eventId}`)
      .set('Authorization', `Bearer ${jwtToken}`);
  });

  it('F114 - Notifications: Mark notifications as read', async () => {
    // Fetch existing notifications
    const listRes = await request(app.getHttpServer())
      .get('/api/messaging/notifications')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(listRes.status).toBe(200);

    // Mark all as read
    const markRes = await request(app.getHttpServer())
      .put('/api/messaging/notifications/read-all')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(markRes.status).toBe(200);

    // Unread count should be 0
    const unreadRes = await request(app.getHttpServer())
      .get('/api/messaging/notifications/unread-count')
      .set('Authorization', `Bearer ${jwtToken}`);

    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBe(0);
  });
});
