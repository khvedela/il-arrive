import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InterventionRepository } from './intervention.repository';

export interface TrackingLinkResult {
  token: string;
  url: string;
}

@Injectable()
export class TrackingLinkService {
  constructor(private readonly interventionRepository: InterventionRepository) {}

  private generateToken(): string {
    const buffer = crypto.randomBytes(32);
    return buffer.toString('base64url');
  }

  async createTrackingLink(businessId: string, interventionId: string): Promise<TrackingLinkResult> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const existingLink = await this.interventionRepository.findTrackingLinkByInterventionId(
      interventionId,
      businessId,
    );

    if (existingLink) {
      await this.revokeTrackingLink(existingLink.id, businessId);
    }

    const token = this.generateToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const trackingLink = await this.interventionRepository.createTrackingLink({
      intervention: { connect: { id: interventionId } },
      tokenHash,
      createdAt: new Date(),
      expiresAt: this.calculateExpiry(intervention),
    });

    return {
      token,
      url: `/public/track/${token}`,
    };
  }

  async getTrackingLinkByToken(token: string): Promise<any> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const trackingLink = await this.interventionRepository.findTrackingLinkByTokenHash(tokenHash);

    if (!trackingLink) {
      return null;
    }

    const intervention = await this.interventionRepository.findById(
      trackingLink.interventionId,
      trackingLink.businessId,
    );

    if (!intervention) {
      return null;
    }

    return {
      trackingLink,
      intervention,
    };
  }

  async copyTrackingLink(businessId: string, interventionId: string): Promise<TrackingLinkResult> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const trackingLink = await this.interventionRepository.findTrackingLinkByInterventionId(
      interventionId,
      businessId,
    );

    if (!trackingLink) {
      throw new NotFoundException(`Tracking link not found for intervention ${interventionId}`);
    }

    const tokenHash = trackingLink.tokenHash;
    const token = this.deriveTokenFromHash(tokenHash);

    return {
      token,
      url: `/public/track/${token}`,
    };
  }

  async regenerateTrackingLink(
    businessId: string,
    interventionId: string,
  ): Promise<{ token: string; url: string }> {
    const intervention = await this.interventionRepository.findById(interventionId, businessId);
    if (!intervention) {
      throw new NotFoundException(`Intervention ${interventionId} not found`);
    }

    const trackingLink = await this.interventionRepository.findTrackingLinkByInterventionId(
      interventionId,
      businessId,
    );

    if (!trackingLink) {
      return this.createTrackingLink(businessId, interventionId);
    }

    const newToken = this.generateToken();
    const newTokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

    await this.interventionRepository.revokeTrackingLink(trackingLink.id, businessId);

    await this.interventionRepository.createTrackingLink({
      intervention: { connect: { id: interventionId } },
      tokenHash: newTokenHash,
      createdAt: new Date(),
      expiresAt: this.calculateExpiry(intervention),
    });

    return {
      token: newToken,
      url: `/public/track/${newToken}`,
    };
  }

  async revokeTrackingLink(
    trackingLinkId: string,
    businessId: string,
  ): Promise<{ revoked: boolean; revokedAt: Date }> {
    const revokedLink = await this.interventionRepository.revokeTrackingLink(trackingLinkId, businessId);

    if (!revokedLink) {
      throw new NotFoundException(`Tracking link ${trackingLinkId} not found`);
    }

    return {
      revoked: true,
      revokedAt: revokedLink.revokedAt as Date,
    };
  }

  private deriveTokenFromHash(tokenHash: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let token = '';
    for (let i = 0; i < 32; i++) {
      const charCode = parseInt(tokenHash.slice(i * 2, i * 2 + 2), 16);
      token += alphabet[charCode % alphabet.length];
    }
    return token;
  }

  private calculateExpiry(intervention: any): Date {
    const now = new Date();
    const windowEnd = new Date(intervention.windowEnd);

    let expiry: Date;

    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      const completeDate = intervention.completedAt || windowEnd;
      expiry = new Date(completeDate.getTime() + 48 * 60 * 60 * 1000);
    } else {
      expiry = new Date(windowEnd.getTime() + 48 * 60 * 60 * 1000);
    }

    return expiry;
  }
}
