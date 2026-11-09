import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { hashToken, linkExpiry, TrackingLinkService as SharedTrackingLinks } from '../intervention/tracking-link.service';

export class TrackingLinkExpiredError extends Error {
  constructor() { super('tracking_link_expired'); }
}

export class TrackingLinkRevokedError extends Error {
  constructor() { super('tracking_link_revoked'); }
}

/** Reuses a still-active URL already held by the outbox; otherwise uses shared rotation. */
@Injectable()
export class TrackingLinkService {
  constructor(private readonly prisma: PrismaService, private readonly shared: SharedTrackingLinks) {}

  async issue(
    intervention: { id: string; windowEnd: Date },
    now = new Date(),
    db?: Prisma.TransactionClient,
    allowRegenerate = false,
  ): Promise<string> {
    if (linkExpiry(intervention.windowEnd) <= now) throw new TrackingLinkExpiredError();
    const resolve = async (tx: Prisma.TransactionClient) => {
      // Same lock as shared revoke/rotate, including when called inside quota reservation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${intervention.id}))`;
      const active = await tx.trackingLink.findFirst({
        where: { interventionId: intervention.id, revokedAt: null },
      });
      if (!active && !allowRegenerate && await tx.trackingLink.count({ where: { interventionId: intervention.id, revokedAt: { not: null } } })) {
        throw new TrackingLinkRevokedError();
      }
      if (active && active.expiresAt > now) {
        const previous = await tx.notification.findMany({
          where: { interventionId: intervention.id, body: { not: '' } },
          orderBy: { createdAt: 'desc' },
          select: { body: true },
        });
        for (const n of previous) {
          const token = n.body.match(/\/t\/([A-Za-z0-9_-]+)/)?.[1];
          if (token && hashToken(token) === active.tokenHash) return this.shared.urlFor(token);
        }
      }
      // Raw tokens are only returned once by SLA-8. If none is available, rotate rather
      // than deriving an invalid token from a hash or leaving multiple active links.
      return (await this.shared.issue(intervention.id, intervention.windowEnd, tx)).url;
    };
    return db ? resolve(db) : this.prisma.$transaction(resolve);
  }
}
