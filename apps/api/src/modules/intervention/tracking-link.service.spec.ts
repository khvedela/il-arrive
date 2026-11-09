import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterventionRepository } from './intervention.repository';
import { PublicTrackingService } from './public-tracking.service';
import { TrackingLinkService, hashToken, linkExpiry } from './tracking-link.service';

interface StoredLink {
  id: number;
  interventionId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const windowEnd = new Date('2026-01-10T11:00:00Z');

/** In-memory stand-in for the link-related repository methods. */
function fakeRepository() {
  const links: StoredLink[] = [];
  const repo = {
    findById: jest.fn(async (id: string, businessId: string) =>
      id === 'i1' && businessId === 'b1' ? { id, businessId, windowEnd } : null,
    ),
    replaceLink: jest.fn(async (interventionId: string, tokenHash: string, expiresAt: Date) => {
      links.filter((l) => l.interventionId === interventionId && !l.revokedAt).forEach((l) => (l.revokedAt = new Date()));
      const link = { id: links.length + 1, interventionId, tokenHash, expiresAt, revokedAt: null };
      links.push(link);
      return link;
    }),
    findActiveLinkByHash: jest.fn(async (hash: string) => links.find((l) => l.tokenHash === hash && !l.revokedAt) ?? null),
    revokeLinks: jest.fn(async () => 0),
  };
  return { repo, links };
}

const config = { get: () => 'https://track.example.com/' } as unknown as ConfigService;

describe('TrackingLinkService', () => {
  it('stores only the SHA-256 hash of the token, never the token', async () => {
    const { repo, links } = fakeRepository();
    const service = new TrackingLinkService(repo as unknown as InterventionRepository, config);

    const issued = await service.regenerate('b1', 'i1');

    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(issued.url).toBe(`https://track.example.com/t/${issued.token}`);
    expect(links).toHaveLength(1);
    expect(links[0].tokenHash).toBe(hashToken(issued.token));
    expect(JSON.stringify(links)).not.toContain(issued.token);
    expect(issued.expiresAt).toEqual(linkExpiry(windowEnd));
  });

  it('resend/copy = regenerate: revokes the old link and returns a different working token', async () => {
    const { repo, links } = fakeRepository();
    const service = new TrackingLinkService(repo as unknown as InterventionRepository, config);

    const first = await service.regenerate('b1', 'i1');
    const second = await service.regenerate('b1', 'i1');

    expect(second.token).not.toBe(first.token);
    expect(links.filter((l) => !l.revokedAt)).toHaveLength(1);
    expect(await repo.findActiveLinkByHash(hashToken(first.token))).toBeNull();
    expect(await repo.findActiveLinkByHash(hashToken(second.token))).not.toBeNull();
  });

  it('does not expose a way to recover a raw token', () => {
    const service = new TrackingLinkService({} as InterventionRepository, config) as unknown as Record<string, unknown>;
    expect(service.copyTrackingLink).toBeUndefined();
    expect(service.deriveTokenFromHash).toBeUndefined();
  });

  it('refuses to issue for another business intervention', async () => {
    const { repo } = fakeRepository();
    const service = new TrackingLinkService(repo as unknown as InterventionRepository, config);
    await expect(service.regenerate('other-business', 'i1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.replaceLink).not.toHaveBeenCalled();
  });
});

describe('PublicTrackingService', () => {
  const now = new Date('2026-01-10T10:00:00Z');
  const intervention = (over: object = {}) => ({
    status: 'EN_ROUTE',
    windowStart: new Date('2026-01-10T09:00:00Z'),
    windowEnd,
    addressLabel: '1 rue X',
    delayMinutes: null,
    delayReason: null,
    completedAt: null,
    updatedAt: now,
    business: { name: 'Plomberie', logoUrl: null, phone: '+33100000000' },
    technician: { user: { firstName: 'Jean', avatarUrl: null } },
    trackingSessions: [
      { endedAt: null, lastLat: 48.856614, lastLng: 2.352222, lastFixAt: new Date(now.getTime() - 30_000), etaAt: null, etaComputedAt: null },
    ],
    ...over,
  });

  const build = (link: object | null, i: object | null) =>
    new PublicTrackingService({
      findActiveLinkByHash: async () => link,
      findForPublic: async () => i,
    } as unknown as InterventionRepository);

  const link = { interventionId: 'i1', expiresAt: new Date(windowEnd.getTime() + 48 * 3600e3) };

  it('looks the token up by hash and rounds a fresh position to 4 decimals', async () => {
    const repo = { findActiveLinkByHash: jest.fn(async () => link), findForPublic: async () => intervention() };
    const service = new PublicTrackingService(repo as unknown as InterventionRepository);
    const p = await service.getPublicTracking('raw-token', now);
    expect(repo.findActiveLinkByHash).toHaveBeenCalledWith(hashToken('raw-token'));
    expect(p.location).toMatchObject({ lat: 48.8566, lng: 2.3522, status: 'FRESH' });
    expect(p.technicianFirstName).toBe('Jean');
  });

  it('hides coordinates when the last fix is older than 120 s', async () => {
    const stale = intervention({
      trackingSessions: [{ endedAt: null, lastLat: 1, lastLng: 2, lastFixAt: new Date(now.getTime() - 121_000) }],
    });
    const p = await build(link, stale).getPublicTracking('t', now);
    expect(p.location).toEqual({ status: 'STALE', lastFixAt: expect.any(String) });
  });

  it('never returns a position outside EN_ROUTE', async () => {
    const p = await build(link, intervention({ status: 'ARRIVED' })).getPublicTracking('t', now);
    expect(p.location).toBeUndefined();
  });

  it('404 for unknown/revoked token, 410 past hard expiry and after the 24 h final-state window', async () => {
    await expect(build(null, null).getPublicTracking('t', now)).rejects.toMatchObject({ status: 404 });
    await expect(
      build({ ...link, expiresAt: new Date(now.getTime() - 1) }, intervention()).getPublicTracking('t', now),
    ).rejects.toMatchObject({ status: 410 });
    const done = intervention({ status: 'COMPLETED', completedAt: new Date(now.getTime() - 25 * 3600e3) });
    await expect(build(link, done).getPublicTracking('t', now)).rejects.toMatchObject({ status: 410 });
    const recent = intervention({ status: 'COMPLETED', completedAt: new Date(now.getTime() - 3600e3) });
    await expect(build(link, recent).getPublicTracking('t', now)).resolves.toMatchObject({ status: 'COMPLETED' });
  });
});
