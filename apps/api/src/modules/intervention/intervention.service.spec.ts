import { ForbiddenException } from '@nestjs/common';
import { InterventionService } from './intervention.service';
import { InterventionRepository } from './intervention.repository';
import { TrackingLinkService } from './tracking-link.service';

const BUSINESS = 'b1';
const base = {
  id: 'i1',
  businessId: BUSINESS,
  status: 'SCHEDULED',
  technicianMembershipId: 'm-tech',
  scheduledDate: new Date(),
  windowStart: new Date(Date.now() - 3600e3),
  windowEnd: new Date(Date.now() + 3600e3),
};

/** memberships: userId -> technician membership id (absent = not a technician). */
function build(memberships: Record<string, string>) {
  const repo = {
    findTechnicianMembershipId: jest.fn(async (userId: string) => memberships[userId] ?? null),
    findById: jest.fn(async () => ({ ...base })),
    applyTransition: jest.fn(async (_id: string, _b: string, _from: string, patch: { status: string }) => ({
      ...base,
      ...patch,
    })),
    extendLinks: jest.fn(),
  };
  const service = new InterventionService(repo as unknown as InterventionRepository, {} as TrackingLinkService);
  return { service, repo };
}

describe('technician access (solo-pro owner flow)', () => {
  it('eligible owner (has technician membership) assigned to the job can mutate it', async () => {
    const { service, repo } = build({ 'owner-1': 'm-tech' });
    const updated = await service.enRouteIntervention(BUSINESS, 'i1', 'owner-1');
    expect(updated.status).toBe('EN_ROUTE');
    expect(repo.applyTransition).toHaveBeenCalledTimes(1);
  });

  it('owner without a technician membership is rejected and nothing is written', async () => {
    const { service, repo } = build({});
    await expect(service.enRouteIntervention(BUSINESS, 'owner-1', 'owner-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getMyInterventions(BUSINESS, 'owner-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.applyTransition).not.toHaveBeenCalled();
  });

  it('eligible technician who is not the assignee cannot read or mutate', async () => {
    const { service, repo } = build({ 'tech-2': 'm-other' });
    await expect(service.enRouteIntervention(BUSINESS, 'i1', 'tech-2')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.completeIntervention(BUSINESS, 'i1', 'tech-2')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getMyIntervention(BUSINESS, 'i1', 'tech-2')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.reportDelay(BUSINESS, 'i1', 'tech-2', { delayMinutes: 10, delayReason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.applyTransition).not.toHaveBeenCalled();
  });

  it('lists only the caller own membership jobs (no caller-supplied technician filter)', async () => {
    const { service } = build({ 'owner-1': 'm-tech' });
    const list = jest.fn(async () => []);
    (service as unknown as { repository: { list: typeof list } }).repository.list = list;
    await service.getMyInterventions(BUSINESS, 'owner-1', 'SCHEDULED');
    expect(list).toHaveBeenCalledWith(BUSINESS, { status: 'SCHEDULED', technicianMembershipId: 'm-tech' });
  });
});
