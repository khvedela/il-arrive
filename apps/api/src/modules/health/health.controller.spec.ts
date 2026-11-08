import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrisma = {
    $queryRaw: jest.fn(() => Promise.resolve([{ ok: 1 }])),
  };

  const mockRedis = {
    ping: jest.fn(() => Promise.resolve('PONG')),
    quit: jest.fn(() => Promise.resolve()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return ok when both db and redis are healthy', async () => {
    const result = await controller.health();
    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('ok');
    expect(result.checks.redis).toBe('ok');
  });

  it('should return error when db is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const result = await controller.health();
    expect(result.status).toBe('error');
    expect(result.checks.database).toBe('error');
  });

  it('should return error when redis is down', async () => {
    mockRedis.ping.mockRejectedValue(new Error('connection refused'));
    const result = await controller.health();
    expect(result.status).toBe('error');
    expect(result.checks.redis).toBe('error');
  });
});
