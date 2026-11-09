/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic http verb in table test */
import './test-env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma.service';
import { RedisService } from './common/redis.service';
import { BusinessService } from './modules/business/business.service';
import { InterventionService } from './modules/intervention/intervention.service';
import { ListMembersService } from './modules/members/list-members.service';
import { AuthService } from './modules/auth/auth.service';
import { TrackingEventsHub } from './modules/tracking/tracking-events.hub';
import { TrackingScheduler } from './modules/tracking/tracking-maintenance.processor';

const businessService = { getBusiness: jest.fn(async () => ({ id: 'b1' })), updateBusiness: jest.fn(async () => ({ id: 'b1' })) };
const interventionService = {
  listInterventions: jest.fn(async () => []),
  getMyInterventions: jest.fn(async () => []),
  getMyToday: jest.fn(async () => ({ date: '2026-11-09', interventions: [] })),
};
const authService = { changePassword: jest.fn(async () => undefined), getMe: jest.fn(async () => ({})) };

describe('AppModule wiring + authorization', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .overrideProvider(TrackingEventsHub)
      .useValue({ publish: jest.fn(), subscribe: jest.fn() })
      .overrideProvider(TrackingScheduler)
      .useValue({})
      .overrideProvider(BusinessService)
      .useValue(businessService)
      .overrideProvider(InterventionService)
      .useValue(interventionService)
      .overrideProvider(ListMembersService)
      .useValue({ execute: jest.fn(async () => []) })
      .overrideProvider(AuthService)
      .useValue(authService)
      .compile();

    app = moduleRef.createNestApplication();
    // Stand-in for the (deferred) session middleware: principal from a test header.
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const raw = req.headers['x-test-user'];
      if (raw) req.user = JSON.parse(raw);
      next();
    });
    await app.init();
  });

  afterAll(() => app.close());

  const as = (role: string) => JSON.stringify({ userId: 'u1', activeBusinessId: 'b1', role });

  it('resolves every module provider (PrismaService visible in feature modules)', () => {
    expect(app).toBeDefined();
  });

  it.each([
    ['get', '/business'],
    ['patch', '/business'],
    ['get', '/members'],
    ['get', '/interventions'],
    ['get', '/tech/interventions'],
    ['get', '/auth/me'],
    ['patch', '/auth/password'],
  ])('%s %s -> 401 without a principal', async (method, url) => {
    await (request(app.getHttpServer()) as any)[method](url).expect(401);
  });

  it('business: any role reads, only OWNER mutates', async () => {
    const http = request(app.getHttpServer());
    await http.get('/business').set('x-test-user', as('TECHNICIAN')).expect(200);
    await http.patch('/business').set('x-test-user', as('DISPATCHER')).send({}).expect(403);
    await http.patch('/business').set('x-test-user', as('TECHNICIAN')).send({}).expect(403);
    await http.patch('/business').set('x-test-user', as('OWNER')).send({}).expect(200);
  });

  it('members: OWNER/DISPATCHER list, TECHNICIAN forbidden', async () => {
    const http = request(app.getHttpServer());
    await http.get('/members').set('x-test-user', as('DISPATCHER')).expect(200);
    await http.get('/members').set('x-test-user', as('TECHNICIAN')).expect(403);
  });

  it('interventions: business-wide reads are not open to TECHNICIAN', async () => {
    const http = request(app.getHttpServer());
    await http.get('/interventions?technicianId=someone-else').set('x-test-user', as('TECHNICIAN')).expect(403);
    await http.get('/interventions/today').set('x-test-user', as('TECHNICIAN')).expect(403);
    await http.get('/interventions/abc').set('x-test-user', as('TECHNICIAN')).expect(403);
    await http.get('/interventions').set('x-test-user', as('DISPATCHER')).expect(200);
    expect(interventionService.listInterventions).toHaveBeenCalled();
  });

  it('tech routes: TECHNICIAN and OWNER (solo pro) reach the service, which enforces membership', async () => {
    const http = request(app.getHttpServer());
    await http.get('/tech/interventions').set('x-test-user', as('TECHNICIAN')).expect(200);
    await http.get('/tech/interventions').set('x-test-user', as('OWNER')).expect(200);
    expect(interventionService.getMyInterventions).toHaveBeenCalledWith('b1', 'u1', undefined);
    await http.get('/tech/interventions/today').set('x-test-user', as('TECHNICIAN')).expect(200);
    expect(interventionService.getMyToday).toHaveBeenCalledWith('b1', 'u1');
  });

  it('change password uses the authenticated user id, not a literal', async () => {
    await request(app.getHttpServer())
      .patch('/auth/password')
      .set('x-test-user', as('OWNER'))
      .send({ currentPassword: 'a', newPassword: 'b' })
      .expect(204);
    expect(authService.changePassword).toHaveBeenCalledWith('u1', expect.anything());
  });
});
