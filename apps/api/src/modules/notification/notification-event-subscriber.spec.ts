import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationEventSubscriber } from './notification-event-subscriber';
import { NotificationEventsService } from './notification-events.service';

type Row = {
  id: string; interventionId: string; type: string; payload: Record<string, unknown>;
  createdAt: Date; notificationProcessedAt: Date | null; notificationNextAttemptAt: Date;
  notificationAttempts: number; notificationLastError: string | null;
};

function row(id: string, type = 'intervention.created'): Row {
  return {
    id, interventionId: `iv-${id}`, type, payload: {}, createdAt: new Date(0),
    notificationProcessedAt: null, notificationNextAttemptAt: new Date(0),
    notificationAttempts: 0, notificationLastError: null,
  };
}

// Stateful double honors the real eligibility predicate and ordering, not a canned page.
function fixture(rows: Row[]) {
  const findMany = jest.fn(async (args) => rows.filter((r) =>
    r.notificationProcessedAt === args.where.notificationProcessedAt &&
    r.notificationNextAttemptAt <= args.where.notificationNextAttemptAt.lte,
  ).sort((a, b) => {
    for (const order of args.orderBy) {
      const key = Object.keys(order)[0] as keyof Row;
      const av = a[key]!; const bv = b[key]!;
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  }).slice(0, args.take));
  const update = jest.fn(async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id)!, data));
  const updateMany = jest.fn(async ({ where, data }) => {
    const r = rows.find((r) => r.id === where.id && r.notificationProcessedAt === null);
    if (!r) return { count: 0 };
    Object.assign(r, data, { notificationAttempts: r.notificationAttempts + data.notificationAttempts.increment });
    return { count: 1 };
  });
  const handle = jest.fn().mockResolvedValue({ status: 'queued', notificationId: 'n' });
  const db = { interventionEvent: { findMany, update, updateMany } };
  const subscriber = () => new NotificationEventSubscriber(db as unknown as PrismaService,
    { handle } as unknown as NotificationEventsService);
  return { subscriber, handle, findMany, update, updateMany };
}

describe('NotificationEventSubscriber durable retries', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-09T10:00:00Z'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('processes healthy rows after more than 100 poison rows, including when old retries are due', async () => {
    const poison = Array.from({ length: 205 }, (_, i) => row(`poison-${i}`, 'intervention.eta.updated'));
    const healthy = row('healthy');
    const f = fixture([...poison, healthy]);
    await f.subscriber().drain();
    // Reconstruct consumers and advance beyond backoff: neither process memory nor
    // a short retry delay may be what lets later businesses progress.
    jest.setSystemTime(Date.now() + 10_000);
    await f.subscriber().drain();
    jest.setSystemTime(Date.now() + 10_000);
    await f.subscriber().drain();
    expect(f.handle).toHaveBeenCalledWith({ interventionId: 'iv-healthy', type: 'intervention.created' }, expect.any(Date), 'healthy');
    expect(healthy.notificationProcessedAt).not.toBeNull();
    expect(poison.every((r) => r.notificationProcessedAt === null)).toBe(true);
    expect(poison.every((r) => r.notificationAttempts > 0 && r.notificationLastError?.includes('invalid ETA'))).toBe(true);
  });

  it('persists backoff, recovers a transient reservation failure and reuses the timeline ID', async () => {
    const event = row('stable-id');
    const f = fixture([event]);
    f.handle.mockRejectedValueOnce(new Error('reservation unavailable'));
    await f.subscriber().drain();
    expect(event.notificationProcessedAt).toBeNull();
    expect(event.notificationLastError).toBe('reservation unavailable');
    expect(event.notificationAttempts).toBe(1);
    expect(event.notificationNextAttemptAt.getTime()).toBe(Date.now() + 1000);
    await f.subscriber().drain();
    expect(f.handle).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 1000);
    await f.subscriber().drain();
    expect(event.notificationProcessedAt).not.toBeNull();
    expect(event.notificationLastError).toBeNull();
    expect(f.handle.mock.calls.map((args) => args[2])).toEqual(['stable-id', 'stable-id']);
  });

  it('replays the same ID if acknowledgement fails after a successful reservation', async () => {
    const event = row('ack-replay');
    const f = fixture([event]);
    f.update.mockRejectedValueOnce(new Error('ack unavailable'));
    await f.subscriber().drain();
    expect(event.notificationProcessedAt).toBeNull();
    jest.setSystemTime(Date.now() + 1000);
    f.handle.mockResolvedValueOnce({ status: 'duplicate', notificationId: 'n' });
    await f.subscriber().drain();
    expect(event.notificationProcessedAt).not.toBeNull();
    expect(f.handle.mock.calls.map((args) => args[2])).toEqual(['ack-replay', 'ack-replay']);
  });

  it('caps exponential retries at one hour and retains diagnostics without acknowledgement', async () => {
    const event = row('poison', 'intervention.rescheduled');
    event.notificationAttempts = 20;
    const f = fixture([event]);
    await f.subscriber().drain();
    expect(event.notificationNextAttemptAt.getTime()).toBe(Date.now() + 3600_000);
    expect(event.notificationAttempts).toBe(21);
    expect(event.notificationProcessedAt).toBeNull();
    expect(event.notificationLastError).toContain('invalid reschedule');
  });
});
