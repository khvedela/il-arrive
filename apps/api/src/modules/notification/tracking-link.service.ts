import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

const POST_WINDOW_MS = 48 * 3600 * 1000;

export class TrackingLinkExpiredError extends Error {
  constructor() {
    super('tracking_link_expired');
  }
}

/**
 * Issues a customer-facing tracking URL (only the SHA-256 token hash is stored).
 * Expiry follows the contract: windowEnd + 48h. Regeneration/revocation of
 * existing links belongs to the SLA-8 tracking lifecycle.
 */
@Injectable()
export class TrackingLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issue(
    intervention: { id: string; windowEnd: Date },
    now = new Date(),
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    // Hard contract expiry: windowEnd + 48h; never extended for past interventions.
    const expiresAt = new Date(intervention.windowEnd.getTime() + POST_WINDOW_MS);
    if (expiresAt <= now) throw new TrackingLinkExpiredError();
    await db.trackingLink.create({
      data: {
        interventionId: intervention.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt,
      },
    });
    const base = this.config.get<string>('FRONTEND_TRACK_URL', 'http://localhost:4201');
    return `${base.replace(/\/$/, '')}/t/${token}`;
  }
}
