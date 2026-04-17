import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication & Password Reset API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {}
    await app.close();
  });

  it('F013 - Password Reset: User can request password reset and use the token to set a new password', async () => {
    // We know admin@edustack.cz exists from the seed
    const targetEmail = 'admin@edustack.cz';

    // 1. Request password reset
    const forgotRes = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: targetEmail });

    expect(forgotRes.status).toBe(201); // Or 200 depending on implementation
    expect(forgotRes.body.message).toBe('ok');

    // 2. Fetch the user from DB to get the reset token (since it was sent via email)
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });
    expect(user).toBeDefined();
    expect(user?.passwordResetToken).toBeDefined();

    // Note: The raw token is hashed before storing in the database.
    // We can't directly test the reset endpoint without the raw token unless we mock it or create our own token.
    // Let's create our own token for a dummy user or manually update the database.

    const dummyEmail = `reset-test-${Date.now()}@edustack.cz`;
    const dummyUser = await prisma.user.create({
      data: {
        email: dummyEmail,
        firstName: 'Reset',
        lastName: 'Test',
        passwordHash: 'old_password_hash',
      },
    });

    // Request reset again for dummy user
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: dummyEmail });

    // Because the token is hashed in the DB, we can't extract the raw token to use the actual reset endpoint.
    // However, the test proves the "forgot-password" endpoint completes successfully.
    // Let's manually set a known hashed token in the DB to test the reset endpoint.
    const bcrypt = require('bcrypt');
    const rawToken = 'test-reset-token-123';
    const hashedToken = await bcrypt.hash(rawToken, 10);

    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await prisma.user.update({
      where: { id: dummyUser.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
    });

    const fullToken = `${dummyUser.id}.${rawToken}`;

    // 3. Reset password
    const resetRes = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        token: fullToken,
        password: 'NewStrongPassword123',
      });

    expect([200, 201]).toContain(resetRes.status);
    expect(resetRes.body.message).toContain(
      'Password has been reset successfully',
    );

    // 4. Verify user can login with new password
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: dummyEmail,
        password: 'NewStrongPassword123',
      });

    expect(loginRes.status).toBe(201); // Or 200
    expect(loginRes.body).toHaveProperty('access_token');
  });
});
