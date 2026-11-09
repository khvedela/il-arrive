import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma.service';
import { RedisService } from '../../src/common/redis.service';
import { AppModule } from '../../src/app.module';

describe('HealthController (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: RedisService;

  beforeAll(async () => {
    process.env.APP_ENV = 'development';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    redis = moduleFixture.get(RedisService);
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
    await app.close();
  });

  it('GET /health returns ok when db and redis are healthy', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(body.checks.database).toBe('ok');
        expect(body.checks.redis).toBe('ok');
      });
  });
});
