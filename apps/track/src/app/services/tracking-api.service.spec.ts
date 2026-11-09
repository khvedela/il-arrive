import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TrackingApi } from './tracking-api.service';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  closed = false;
  onerror: ((e: Event) => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(): void {}
  close(): void {
    this.closed = true;
  }
}

describe('TrackingApi default (localhost, no opt-in)', () => {
  let api: TrackingApi;
  let http: HttpTestingController;

  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as any).EventSource = FakeEventSource;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(TrackingApi);
    http = TestBed.inject(HttpTestingController);
  });

  it('uses jsdom localhost and does a real token GET', () => {
    expect(window.location.hostname).toBe('localhost');
    api.fetchProjection('confirmed-abc123').subscribe({ error: () => undefined });
    const req = http.expectOne('/api/public/track/confirmed-abc123');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it.each([404, 410])('propagates real %s', (status) => {
    let got: { status?: number } | undefined;
    api.fetchProjection('real-token').subscribe({ error: (e) => (got = e) });
    http.expectOne('/api/public/track/real-token').flush(null, { status, statusText: 'x' });
    expect(got?.status).toBe(status);
  });

  it('opens a real EventSource and closes it on unsubscribe', () => {
    const sub = api.subscribeToEvents('real-token').subscribe();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/api/public/track/real-token/events');
    sub.unsubscribe();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
