import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  async health() {
    let dbStatus = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'ok';
    } catch {
      // db error
    }

    let redisStatus = 'error';
    try {
      const ping = await this.redis.ping();
      redisStatus = ping === 'PONG' ? 'ok' : 'error';
    } catch {
      // redis error
    }

    const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'error';

    return {
      status,
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }
}
