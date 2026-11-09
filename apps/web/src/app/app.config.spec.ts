import { Observable, of, throwError } from 'rxjs';
import { restoreSession } from './app.config';

type Auth = Parameters<typeof restoreSession>[0];

describe('restoreSession (app initializer)', () => {
  it('resolves only after bootstrap completes, before routing', async () => {
    let done = false;
    const bootstrap = jest.fn(
      () =>
        new Observable((s) => {
          setTimeout(() => {
            done = true;
            s.next({});
            s.complete();
          }, 5);
        }),
    );
    await restoreSession({ bootstrap } as Auth);
    expect(bootstrap).toHaveBeenCalled();
    expect(done).toBe(true);
  });

  it('swallows a 401 so the app still starts', async () => {
    const auth: Auth = { bootstrap: () => throwError(() => ({ status: 401 })) };
    await expect(restoreSession(auth)).resolves.toBeUndefined();
  });

  it.each(['/tech', '/tech/i/42'])('restores the session on a cold load of %s', async () => {
    const bootstrap = jest.fn(() => of({}));
    await restoreSession({ bootstrap } as Auth);
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });
});
