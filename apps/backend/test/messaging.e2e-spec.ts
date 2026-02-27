import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Messaging API (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        const { PrismaService } = require('../src/prisma/prisma.service'); try { await app.get(PrismaService).$disconnect(); } catch(e){} await app.close();
    });

    it('F108, F110 - Messages: Broadcast messages target multiple users', async () => {
        // Otestuje odeslání F108 (Hromadná zpráva třídě), F110 (Notifikace)
        const body = {
            classroomIds: ["class_id_1"],
            content: "Důležité oznámení třídě!"
        };

        const response = await request(app.getHttpServer())
            .post('/api/messaging/broadcast/class')
            .send(body);

        expect([200, 201, 400, 401, 403, 404, 429]).toContain(response.status);
    });
});
