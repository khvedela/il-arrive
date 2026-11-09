import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';

const LINK_TTL_MS = 48 * 3600 * 1000;

/** Issues a customer-facing tracking URL (only the token hash is stored). */
@Injectable()
export class TrackingLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issue(interventionId: string, now = new Date()): Promise<string> {
    const token = randomBytes(24).toString('base64url');
    await this.prisma.trackingLink.create({
      data: {
        interventionId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(now.getTime() + LINK_TTL_MS),
      },
    });
    const base = this.config.get<string>('FRONTEND_TRACK_URL', 'http://localhost:4201');
    return `${base.replace(/\/$/, '')}/t/${token}`;
  }
}
