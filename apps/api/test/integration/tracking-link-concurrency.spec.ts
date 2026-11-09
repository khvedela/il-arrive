import { PrismaService } from '../../src/common/prisma.service';
import { InterventionRepository } from '../../src/modules/intervention/intervention.repository';
import { hashToken } from '../../src/modules/intervention/tracking-link.service';

/** Needs a migrated PostgreSQL (docker compose up postgres; pnpm db:migrate). */
describe('tracking link rotation under concurrency (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const repo = new InterventionRepository(prisma);
  let interventionId: string;
  let businessId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const suffix = Date.now().toString(36);
    const business = await prisma.business.create({ data: { name: 'T', slug: `t-${suffix}`, phone: '+33100000000' } });
    businessId = business.id;
    const customer = await prisma.customer.create({ data: { businessId, name: 'C', phone: '+33600000000' } });
    const now = new Date();
    const i = await prisma.intervention.create({
      data: {
        businessId,
        customerId: customer.id,
        addressLabel: 'x',
        scheduledDate: now,
        windowStart: now,
        windowEnd: new Date(now.getTime() + 3600e3),
      },
    });
    interventionId = i.id;
  });

  afterAll(async () => {
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.$disconnect();
  });

  it('leaves exactly one active link after N concurrent regenerations from a no-link state', async () => {
    const expiresAt = new Date(Date.now() + 3600e3);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, n) => repo.replaceLink(interventionId, hashToken(`tok-${n}`), expiresAt)),
    );
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const active = await prisma.trackingLink.count({ where: { interventionId, revokedAt: null } });
    expect(active).toBe(1);
  });

  it('the partial unique index rejects a second active link inserted behind the repository', async () => {
    await expect(
      prisma.trackingLink.create({ data: { interventionId, tokenHash: 'dup-1', expiresAt: new Date() } }),
    ).rejects.toBeDefined();
  });
});
