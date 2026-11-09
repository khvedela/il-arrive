import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardApi } from '../../dashboard/dashboard-api.service';
import { InterventionsStore } from '../../dashboard/interventions.store';
import { makeRow } from '../../dashboard/testing';
import { TodayComponent } from './today.component';

describe('TodayComponent', () => {
  const api = { today: jest.fn(), members: jest.fn(), get: jest.fn() };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('renders the four dispatcher groups from GET /interventions/today and opens the panel on click', async () => {
    api.members.mockReturnValue(of([]));
    api.today.mockReturnValue(of([
      { status: 'EN_ROUTE', interventions: [makeRow({ id: 'a', status: 'EN_ROUTE' })] },
      { status: 'COMPLETED', interventions: [makeRow({ id: 'b', status: 'COMPLETED' })] },
    ]));
    api.get.mockReturnValue(of({ intervention: makeRow({ id: 'a', status: 'EN_ROUTE' }), timeline: [] }));
    TestBed.configureTestingModule({ providers: [{ provide: DashboardApi, useValue: api }, provideRouter([])] });
    const fixture = TestBed.createComponent(TodayComponent);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('En route');
    expect(text).toContain('Terminées');
    expect(text).not.toContain('En retard');
    expect(text).not.toContain('en construction');

    (fixture.nativeElement.querySelector('.ia-list-row') as HTMLElement).click();
    await flush();
    expect(TestBed.inject(InterventionsStore).selectedId()).toBe('a');
    fixture.destroy();
  });
});
