import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

/** Dev-only SMS outbox: every notification the console provider "sent". */
@Controller('dev/sms')
export class DevSmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async outbox() {
    if (this.config.get('NODE_ENV') === 'production') throw new NotFoundException();
    return this.prisma.notification.findMany({
      where: { provider: 'console' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
