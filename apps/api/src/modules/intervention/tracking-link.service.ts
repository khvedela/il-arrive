import { randomBytes, createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterventionRepository } from './intervention.repository';

const HARD_EXPIRY_MS = 48 * 60 * 60 * 1000;

export interface IssuedTrackingLink {
  /** Raw token: shown exactly once, never stored. */
  token: string;
  url: string;
  expiresAt: Date;
}

/** SHA-256 hex of the raw token. This is the only form that is ever stored or looked up. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Hard expiry per docs/ARCHITECTURE.md §4: windowEnd + 48 h. */
export function linkExpiry(windowEnd: Date): Date {
  return new Date(windowEnd.getTime() + HARD_EXPIRY_MS);
}

@Injectable()
export class TrackingLinkService {
  constructor(
    private readonly repository: InterventionRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Issues a link for an intervention: revokes any active one, stores only the hash,
   * and returns the raw token once. Used for creation, "copy", "resend" and "regenerate":
   * the raw token of an existing link cannot be recovered, so all of them rotate it.
   */
  async regenerate(businessId: string, interventionId: string): Promise<IssuedTrackingLink> {
    const intervention = await this.repository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }
    return this.issue(interventionId, intervention.windowEnd);
  }

  /** Internal: issue without the tenant lookup, for callers that already loaded the intervention. */
  async issue(interventionId: string, windowEnd: Date): Promise<IssuedTrackingLink> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = linkExpiry(windowEnd);
    await this.repository.replaceLink(interventionId, hashToken(token), expiresAt);
    return { token, url: this.urlFor(token), expiresAt };
  }

  async revoke(businessId: string, interventionId: string): Promise<{ revoked: number }> {
    const intervention = await this.repository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }
    return { revoked: await this.repository.revokeLinks(interventionId, businessId) };
  }

  urlFor(token: string): string {
    const base = this.config.get<string>('FRONTEND_TRACK_URL') ?? 'http://localhost:4201';
    return `${base.replace(/\/+$/, '')}/t/${token}`;
  }
}
