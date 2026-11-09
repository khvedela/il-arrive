import { TestBed } from '@angular/core/testing';
import { TechApi, TechApiService, ACTION_TO_STATUS, VALID_TRANSITIONS } from './tech-api.service';
import { InterventionStatus as IS } from '@il-arrive/contracts/enums';
import { firstValueFrom } from 'rxjs';

describe('TechApi', () => {
  let api: TechApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    api = TestBed.inject(TechApi);
  });

  describe('getTodayInterventions', () => {
    it('returns today date and interventions', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = api.getTodayInterventions();
      expect(result).not.toBeNull();
      expect(result!.date).toBe(today);
      expect(result!.interventions.length).toBeGreaterThan(0);
    });
  });

  describe('getIntervention', () => {
    it('returns intervention by id', () => {
      const todayData = api.getTodayInterventions();
      const firstId = todayData!.interventions[0].id;
      const result = api.getIntervention(firstId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(firstId);
    });

    it('returns null for unknown id', () => {
      const result = api.getIntervention('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('transition', () => {
    it('transitions SCHEDULED to EN_ROUTE with en_route action', () => {
      const data = api.getTodayInterventions()!;
      const scheduled = data.interventions.find(i => i.status === IS.SCHEDULED)!;
      const result = api.transition(scheduled.id, 'en_route');
      expect(result).not.toBeNull();
      expect(result!.intervention.status).toBe(IS.EN_ROUTE);
    });

    it('transitions EN_ROUTE to ARRIVED with arrived action', () => {
      const data = api.getTodayInterventions()!;
      const enRoute = data.interventions.find(i => i.status === IS.EN_ROUTE)!;
      const result = api.transition(enRoute.id, 'arrived');
      expect(result).not.toBeNull();
      expect(result!.intervention.status).toBe(IS.ARRIVED);
    });

    it('transitions ARRIVED to COMPLETED with complete action', () => {
      // First create an arrived intervention
      const data = api.getTodayInterventions()!;
      const enRoute = data.interventions.find(i => i.status === IS.EN_ROUTE)!;
      api.transition(enRoute.id, 'arrived');
      const arrived = api.getIntervention(enRoute.id)!;
      const result = api.transition(arrived.id, 'complete');
      expect(result).not.toBeNull();
      expect(result!.intervention.status).toBe(IS.COMPLETED);
    });

    it('clears delay on completion', () => {
      const data = api.getTodayInterventions()!;
      const withDelay = data.interventions.find(i => i.delayMinutes !== undefined)!;
      expect(withDelay.delayMinutes).toBeGreaterThan(0);

      api.transition(withDelay.id, 'arrived');
      const arrived = api.getIntervention(withDelay.id)!;
      api.transition(arrived.id, 'complete');
      const completed = api.getIntervention(withDelay.id)!;
      expect(completed.delayMinutes).toBeUndefined();
      expect(completed.delayReason).toBeUndefined();
    });
  });

  describe('reportDelay', () => {
    it('sets delayMinutes, delayReason, and computes delayEta', () => {
      const data = api.getTodayInterventions()!;
      const scheduled = data.interventions.find(i => i.status === IS.SCHEDULED)!;
      const result = api.reportDelay({
        interventionId: scheduled.id,
        delayMinutes: 30,
        delayReason: 'Traffic',
      });
      expect(result).not.toBeNull();
      expect(result!.intervention.delayMinutes).toBe(30);
      expect(result!.intervention.delayReason).toBe('Traffic');
      expect(result!.intervention.delayEta).toBeDefined();
    });

    it('returns null for unknown intervention', () => {
      const result = api.reportDelay({
        interventionId: 'nonexistent',
        delayMinutes: 15,
        delayReason: 'Test',
      });
      expect(result).toBeNull();
    });
  });
});

describe('ACTION_TO_STATUS mapping', () => {
  it('maps en_route to EN_ROUTE', () => {
    expect(ACTION_TO_STATUS['en_route']).toBe('EN_ROUTE');
  });

  it('maps arrived to ARRIVED', () => {
    expect(ACTION_TO_STATUS['arrived']).toBe('ARRIVED');
  });

  it('maps complete to COMPLETED', () => {
    expect(ACTION_TO_STATUS['complete']).toBe('COMPLETED');
  });

  it('maps cancel to CANCELLED', () => {
    expect(ACTION_TO_STATUS['cancel']).toBe('CANCELLED');
  });

  it('maps stop_route back to SCHEDULED', () => {
    expect(ACTION_TO_STATUS['stop_route']).toBe('SCHEDULED');
  });
});

describe('VALID_TRANSITIONS', () => {
  it('allows en_route, cancel, stop_route from SCHEDULED', () => {
    expect(VALID_TRANSITIONS['SCHEDULED']).toEqual(['en_route', 'cancel', 'stop_route']);
  });

  it('allows arrived, cancel, stop_route from EN_ROUTE', () => {
    expect(VALID_TRANSITIONS['EN_ROUTE']).toEqual(['arrived', 'cancel', 'stop_route']);
  });

  it('allows complete, cancel from ARRIVED', () => {
    expect(VALID_TRANSITIONS['ARRIVED']).toEqual(['complete', 'cancel']);
  });

  it('allows no transitions from COMPLETED', () => {
    expect(VALID_TRANSITIONS['COMPLETED']).toEqual([]);
  });

  it('allows no transitions from CANCELLED', () => {
    expect(VALID_TRANSITIONS['CANCELLED']).toEqual([]);
  });
});

describe('TechApiService', () => {
  let service: TechApiService;
  let api: TechApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TechApiService);
    api = TestBed.inject(TechApi);
  });

  describe('performAction with optimistic UI and rollback', () => {
    it('returns success result on valid transition', async () => {
      const data = api.getTodayInterventions()!;
      const enRoute = data.interventions.find(i => i.status === IS.EN_ROUTE)!;
      const result = await firstValueFrom(service.performAction(enRoute.id, 'arrived'));
      expect(result.success).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.intervention.status).toBe(IS.ARRIVED);
    });

    it('optimistic state reflects new status before API responds', async () => {
      const data = api.getTodayInterventions()!;
      const scheduled = data.interventions.find(i => i.status === IS.SCHEDULED)!;
      const result = await firstValueFrom(service.performAction(scheduled.id, 'en_route'));
      expect(result.optimistic).toBeDefined();
      expect(result.optimistic!.status).toBe(IS.EN_ROUTE);
    });

    it('rolls back on error when transition fails', async () => {
      // Try to perform a transition on a nonexistent intervention
      const result = await firstValueFrom(service.performAction('nonexistent', 'en_route'));
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
    });
  });

  describe('reportDelay', () => {
    it('successfully reports delay', async () => {
      const data = api.getTodayInterventions()!;
      const scheduled = data.interventions.find(i => i.status === IS.SCHEDULED)!;
      const result = await firstValueFrom(service.reportDelay(scheduled.id, 15, 'Traffic'));
      expect(result.success).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.intervention.delayMinutes).toBe(15);
    });

    it('rolls back on error for unknown intervention', async () => {
      const result = await firstValueFrom(service.reportDelay('nonexistent', 30, 'Test'));
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
    });
  });

  describe('fetchToday', () => {
    it('returns today data', async () => {
      const result = await firstValueFrom(service.fetchToday());
      expect(result.interventions.length).toBeGreaterThan(0);
    });
  });

  describe('fetchIntervention', () => {
    it('returns intervention by id', async () => {
      const data = api.getTodayInterventions()!;
      const firstId = data.interventions[0].id;
      const result = await firstValueFrom(service.fetchIntervention(firstId));
      expect(result.id).toBe(firstId);
    });

    it('throws for nonexistent id', async () => {
      await expect(firstValueFrom(service.fetchIntervention('nonexistent'))).rejects.toThrow();
    });
  });
});
