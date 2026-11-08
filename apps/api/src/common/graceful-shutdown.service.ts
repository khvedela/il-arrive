import {
  INestApplication,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

export class GracefulShutdownService implements OnModuleDestroy {
  constructor(
    private app: INestApplication,
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
  ) {}

  async onModuleDestroy() {
    const timeout = this.configService.get('SHUTDOWN_TIMEOUT', 30000);

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, timeout));

    await Promise.race([
      this.prisma.$disconnect(),
      this.redis.quit(),
      timeoutPromise,
    ]);

    await this.app.close();
  }
}
