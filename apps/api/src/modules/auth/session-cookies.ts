import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'session';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key && !(key in out)) {
      try {
        out[key] = decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        /* ignore malformed value */
      }
    }
  }
  return out;
}

export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

function attrs(maxAgeSec: number, httpOnly: boolean): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure}`;
}

/** Set-Cookie values issued at login: the HttpOnly session token and the readable CSRF double-submit token. */
export function sessionCookieHeaders(accessToken: string, csrfToken: string, ttlMs: number): string[] {
  const maxAge = Math.floor(ttlMs / 1000);
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(accessToken)}; ${attrs(maxAge, true)}`,
    `${CSRF_COOKIE}=${encodeURIComponent(csrfToken)}; ${attrs(maxAge, false)}`,
  ];
}

export function clearedCookieHeaders(): string[] {
  return [`${SESSION_COOKIE}=; ${attrs(0, true)}`, `${CSRF_COOKIE}=; ${attrs(0, false)}`];
}
