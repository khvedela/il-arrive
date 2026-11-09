import { TestBed } from '@angular/core/testing';
import { IaToastService } from './toast-service';

describe('IaToastService', () => {
  let service: IaToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
    service = TestBed.inject(IaToastService);
  });

  it('creates', () => {
    expect(service).toBeTruthy();
  });

  it('adds toast to signal array', () => {
    service.info('Test message');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Test message');
  });

  it('generates unique IDs', () => {
    service.info('First');
    service.info('Second');
    const toasts = service.toasts();
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('caps at 3 toasts', () => {
    service.info('1');
    service.info('2');
    service.info('3');
    service.info('4');
    expect(service.toasts().length).toBe(3);
    expect(service.toasts()[0].message).toBe('2');
  });

  it('auto-dismisses after duration', () => {
    jest.useFakeTimers();
    service.info('Will dismiss');
    jest.advanceTimersByTime(4000);
    expect(service.toasts().length).toBe(0);
    jest.useRealTimers();
  });

  it('does not auto-dismiss error with action', () => {
    jest.useFakeTimers();
    service.error('Error', 'Retry');
    jest.advanceTimersByTime(8000);
    expect(service.toasts().length).toBe(1);
    jest.useRealTimers();
  });

  it('dismisses by ID', () => {
    service.info('Keep');
    const toDismiss = service.toasts()[0];
    service.info('Remove');
    service.dismiss(toDismiss.id);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Remove');
  });

  it('success method sets correct type', () => {
    service.success('Done');
    expect(service.toasts()[0].type).toBe('success');
  });

  it('error method sets correct type', () => {
    service.error('Fail');
    expect(service.toasts()[0].type).toBe('error');
  });

  it('warning method sets correct type', () => {
    service.warning('Warning');
    expect(service.toasts()[0].type).toBe('warning');
  });
});
