import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GDPR and Backups API (e2e)', () => {
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
        try { await app.get(PrismaService).$disconnect(); } catch(e){} 
        await app.close();
    });

    it('F168 - GDPR: Should export user personal data (Article 15)', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/gdpr/my-data')
            .set('Authorization', `Bearer ${jwtToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('exportDate');
        expect(response.body.user.email).toBe('admin@edustack.cz');
    });

    it('F028, F166 - Backups: System admin can list backups', async () => {
        const response = await request(app.getHttpServer())
            .get('/api/system/backups')
            .set('Authorization', `Bearer ${jwtToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
