import { TestBed } from '@angular/core/testing';
import { LocationSharingService } from './location-sharing.service';
import { TechApi } from './tech-api.service';

type PosCb = (p: GeolocationPosition) => void;
type ErrCb = (e: { code: number }) => void;

describe('LocationSharingService', () => {
  let svc: LocationSharingService;
  let api: { sendLocation: jest.Mock };
  let onErr: ErrCb;
  const watchPosition = jest.fn();
  const clearWatch = jest.fn();

  beforeEach(() => {
    watchPosition.mockReset().mockImplementation((_ok: PosCb, err: ErrCb) => {
      onErr = err;
      return 7;
    });
    clearWatch.mockReset();
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    });
    api = { sendLocation: jest.fn().mockResolvedValue('ok') };
    TestBed.configureTestingModule({ providers: [{ provide: TechApi, useValue: api }] });
    svc = TestBed.inject(LocationSharingService);
  });

  it('starts watching and sends a good first fix', async () => {
    svc.start('int-1');
    expect(svc.state()).toBe('sharing');
    await svc.onFix({ lat: 1, lng: 1, accuracy: 10, timestamp: 0 }, 0);
    expect(api.sendLocation).toHaveBeenCalledTimes(1);
  });

  it('throttles and filters inaccurate fixes', async () => {
    svc.start('int-1');
    await svc.onFix({ lat: 1, lng: 1, accuracy: 10, timestamp: 0 }, 0);
    await svc.onFix({ lat: 1, lng: 1, accuracy: 10, timestamp: 0 }, 5000);
    await svc.onFix({ lat: 5, lng: 5, accuracy: 900, timestamp: 0 }, 6000);
    expect(api.sendLocation).toHaveBeenCalledTimes(1);
  });

  it.each(['arrived', 'complete', 'cancel', 'stop_route', 'user', 'logout'] as const)(
    'stop(%s) clears watch and sends nothing afterwards',
    async reason => {
      svc.start('int-1');
      svc.stop(reason);
      expect(clearWatch).toHaveBeenCalledWith(7);
      expect(svc.state()).toBe('idle');
      expect(svc.lastStopReason()).toBe(reason);
      await svc.onFix({ lat: 1, lng: 1, accuracy: 10, timestamp: 0 }, 0);
      expect(api.sendLocation).not.toHaveBeenCalled();
    },
  );

  it('stops on 409 conflict', async () => {
    api.sendLocation.mockResolvedValue('conflict');
    svc.start('int-1');
    await svc.onFix({ lat: 1, lng: 1, accuracy: 10, timestamp: 0 }, 0);
    expect(clearWatch).toHaveBeenCalled();
    expect(svc.state()).toBe('idle');
    expect(svc.lastStopReason()).toBe('conflict');
  });

  it('permission denied -> status-only mode', () => {
    svc.start('int-1');
    onErr({ code: 1 });
    expect(svc.state()).toBe('denied');
    expect(clearWatch).toHaveBeenCalled();
  });

  it('reports unsupported when geolocation is missing', () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', { value: undefined, configurable: true });
    svc.start('int-1');
    expect(svc.state()).toBe('unsupported');
  });
});
