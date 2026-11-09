import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { TrackPageComponent } from './track-page.component';
import { TrackingApi } from '../../services/tracking-api.service';
import { mockFixtures } from '../../data/mock-fixtures';

// Helper to create a mock TrackingApi that returns the given fixture
function mockApi(fixtureKey: string): TrackingApi {
  return {
    fetchProjection: () => of(mockFixtures[fixtureKey]),
    subscribeToEvents: () => of(new MessageEvent('message', { data: '{}' })),
  } as TrackingApi;
}

function mockApiError(status: number, statusText: string): TrackingApi {
  return {
    fetchProjection: () => throwError(() => ({ status, statusText })),
    subscribeToEvents: () => of(new MessageEvent('message', { data: '{}' })),
  } as TrackingApi;
}

function createComponent(token: string, api: TrackingApi): TrackPageComponent {
  TestBed.configureTestingModule({
    imports: [TrackPageComponent],
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (k: string) => k === 'token' ? token : null } } } },
      { provide: Router, useValue: {} as Router },
      { provide: TrackingApi, useValue: api },
    ],
  });

  const fixture = TestBed.createComponent(TrackPageComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return component;
}

describe('TrackPageComponent', () => {
  describe('state: confirmed (scheduled, not today)', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('confirmed-abc123', mockApi('confirmed'));
    });

    it('displays RENDEZ-VOUS CONFIRMÉ hero label', () => {
      expect(comp.heroLabel()).toContain('CONFIRMÉ');
    });

    it('shows the date in hero value', () => {
      expect(comp.heroValue()).not.toBe('—');
    });

    it('shows time window in meta', () => {
      expect(comp.heroMeta()).toContain('entre');
    });

    it('does not show the map', () => {
      expect(comp.showMap()).toBe(false);
    });

    it('shows link-day note for future appointments', () => {
      expect(comp.showLinkDayNote()).toBe(true);
    });

    it('shows the call CTA', () => {
      expect(comp.showCallCta()).toBe(true);
    });

    it('timeline has step 1 current, rest hidden', () => {
      const steps = comp.timelineSteps();
      expect(steps.length).toBe(1);
      expect(steps[0].status).toBe('current');
      expect(steps[0].label).toContain('confirmé');
    });
  });

  describe('state: planned today', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('planned-today-def456', mockApi('planned_today'));
    });

    it('displays INTERVENTION PRÉVUE AUJOURD\'HUI', () => {
      expect(comp.heroLabel()).toContain('PRÉVUE');
    });

    it('shows time window as hero value', () => {
      expect(comp.heroValue()).toContain('08');
      expect(comp.heroValue()).toContain('12');
    });

    it('does not show map', () => {
      expect(comp.showMap()).toBe(false);
    });

    it('timeline has step 2 current', () => {
      const steps = comp.timelineSteps();
      expect(steps[1].status).toBe('current');
    });

    it('does not show link-day note (today)', () => {
      expect(comp.showLinkDayNote()).toBe(false);
    });
  });

  describe('state: en route live', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('enroute-live-ghi789', mockApi('en_route_live'));
    });

    it('displays ARRIVÉE ESTIMÉE', () => {
      expect(comp.heroLabel()).toContain('ESTIMÉE');
    });

    it('shows ETA in hero value', () => {
      expect(comp.heroValue()).toContain('10');
    });

    it('shows the map card', () => {
      expect(comp.showMap()).toBe(true);
    });

    it('does not show stale location card', () => {
      expect(comp.showStaleLocationCard()).toBe(false);
    });

    it('does not show delay banner (no delay)', () => {
      expect(comp.showDelayBanner()).toBe(false);
    });

    it('timeline has steps 1-2 done, step 3 current', () => {
      const steps = comp.timelineSteps();
      expect(steps[0].status).toBe('done');
      expect(steps[1].status).toBe('done');
      expect(steps[2].status).toBe('current');
    });

    it('announces status for a11y', () => {
      expect(comp.statusAnnouncement()).toContain('en route');
    });
  });

  describe('state: en route stale', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('enroute-stale-jkl012', mockApi('en_route_stale'));
    });

    it('hides map', () => {
      expect(comp.showMap()).toBe(false);
    });

    it('shows stale location card', () => {
      expect(comp.showStaleLocationCard()).toBe(true);
    });

    it('keeps last ETA with timestamp', () => {
      expect(comp.heroValue()).toContain('10');
      expect(comp.heroMeta()).toContain('estimée');
    });
  });

  describe('state: delay', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('delay-mno345', mockApi('delay'));
    });

    it('shows delay banner', () => {
      expect(comp.showDelayBanner()).toBe(true);
    });

    it('includes delay info in hero meta', () => {
      expect(comp.heroMeta()).toContain('+30');
    });

    it('shows updated ETA value', () => {
      expect(comp.heroValue()).toContain('11');
    });
  });

  describe('state: arrived', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('arrived-pqr678', mockApi('arrived'));
    });

    it('displays TECHNICIEN ARRIVÉ', () => {
      expect(comp.heroLabel()).toContain('ARRIVÉ');
    });

    it('shows Arrivé as hero value', () => {
      expect(comp.heroValue()).toContain('Arrivé');
    });

    it('is a success state', () => {
      expect(comp.isSuccessState()).toBe(true);
    });

    it('does not show map', () => {
      expect(comp.showMap()).toBe(false);
    });

    it('timeline has steps 1-3 done, step 4 current', () => {
      const steps = comp.timelineSteps();
      expect(steps[3].status).toBe('current');
    });

    it('announces arrived for a11y', () => {
      expect(comp.statusAnnouncement()).toContain('arrivé');
    });
  });

  describe('state: completed', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('completed-stu901', mockApi('completed'));
    });

    it('displays INTERVENTION TERMINÉE', () => {
      expect(comp.heroLabel()).toContain('TERMINÉE');
    });

    it('shows Terminé as hero value', () => {
      expect(comp.heroValue()).toContain('Terminé');
    });

    it('hides call CTA', () => {
      expect(comp.showCallCta()).toBe(false);
    });

    it('timeline has all 5 steps done', () => {
      const steps = comp.timelineSteps();
      expect(steps.length).toBe(5);
      expect(steps.every(s => s.status === 'done')).toBe(true);
    });
  });

  describe('state: cancelled', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('cancelled-vwx234', mockApi('cancelled'));
    });

    it('shows cancelled banner', () => {
      expect(comp.showCancelledBanner()).toBe(true);
    });

    it('displays RENDEZ-VOUS ANNULÉ', () => {
      expect(comp.heroLabel()).toContain('ANNULÉ');
    });

    it('shows Annulé as hero value', () => {
      expect(comp.heroValue()).toContain('Annulé');
    });

    it('does not show map', () => {
      expect(comp.showMap()).toBe(false);
    });

    it('timeline is partial', () => {
      const steps = comp.timelineSteps();
      expect(steps.length).toBeLessThan(5);
    });
  });

  describe('state: rescheduled', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('rescheduled-yza567', mockApi('rescheduled'));
    });

    it('shows rescheduled banner', () => {
      expect(comp.showRescheduledBanner()).toBe(true);
    });

    it('shows new date in banner text', () => {
      expect(comp.rescheduledBannerText()).toBeTruthy();
    });
  });

  describe('expired / 410 error', () => {
    it('shows expired page', () => {
      const comp = createComponent('expired-token', mockApiError(410, 'Gone'));
      expect(comp.isExpiredState()).toBe(true);
      expect(comp.expiredTitle()).toContain('expiré');
    });

    it('expired body mentions contacting business', () => {
      const comp = createComponent('expired-token', mockApiError(410, 'Gone'));
      expect(comp.expiredBody()).toContain('contactez');
    });
  });

  describe('not-found / 404 error', () => {
    it('shows not-found page', () => {
      const comp = createComponent('unknown-token', mockApiError(404, 'Not Found'));
      expect(comp.isExpiredState()).toBe(true);
      expect(comp.expiredTitle()).toContain('introuvable');
    });
  });

  describe('stream subscription ownership', () => {
    it('unsubscribes the old stream on replacement and on destroy', () => {
      const subjects: Subject<MessageEvent>[] = [];
      const api = {
        fetchProjection: () => of(mockFixtures['confirmed']),
        subscribeToEvents: () => {
          const s = new Subject<MessageEvent>();
          subjects.push(s);
          return s;
        },
      } as unknown as TrackingApi;
      const comp = createComponent('confirmed-abc123', api);
      expect(subjects).toHaveLength(1);
      expect(subjects[0].observed).toBe(true);
      // session_end -> closes stream, refetches, opens a new one
      subjects[0].next(new MessageEvent('message', { data: JSON.stringify({ event: 'session_end', data: {} }) }));
      expect(subjects[0].observed).toBe(false);
      expect(subjects).toHaveLength(2);
      expect(subjects[1].observed).toBe(true);
      comp.ngOnDestroy();
      expect(subjects[1].observed).toBe(false);
    });
  });

  describe('formatting helpers', () => {
    let comp: TrackPageComponent;

    beforeEach(() => {
      comp = createComponent('confirmed-abc123', mockApi('confirmed'));
    });

    it('formats ISO time to HH:MM', () => {
      const result = comp.formatTime('2026-11-12T10:31:00.000Z');
      expect(result).toContain('31');
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('formats date to French locale', () => {
      const result = comp.formatDate('2026-11-15');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(5);
    });
  });
});
