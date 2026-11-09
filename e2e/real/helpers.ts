import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

const URLS = { api: 'http://127.0.0.1:3300', track: 'http://127.0.0.1:4401' };
const requireFromApi = createRequire(path.resolve(process.cwd(), 'apps/api/package.json'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = requireFromApi('@prisma/client') as typeof import('@prisma/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const argon2 = requireFromApi('argon2') as typeof import('argon2');

/** Direct DB access: seeding what the product has no endpoint for yet, and the test-only "clock". */
export const db = new PrismaClient();

export const PASSWORD = 'E2e-Passw0rd!';

export function uid(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/** Session-cookie API client: cookies live in the Playwright request context, CSRF double-submit header added to writes. */
export class Api {
  constructor(readonly ctx: APIRequestContext, readonly base = URLS.api) {}

  private async csrf(): Promise<string> {
    const cookies = (await this.ctx.storageState()).cookies;
    return cookies.find((c) => c.name === 'csrf_token')?.value ?? '';
  }

  get(p: string): Promise<APIResponse> {
    return this.ctx.get(`${this.base}${p}`);
  }

  async send(method: 'post' | 'patch' | 'delete', p: string, data?: unknown): Promise<APIResponse> {
    return this.ctx[method](`${this.base}${p}`, { data, headers: { 'x-csrf-token': await this.csrf() } });
  }

  async json<T = any>(res: APIResponse, ok: number[] = [200, 201, 202]): Promise<T> {
    const body = await res.text();
    expect(ok, `${res.url()} -> ${res.status()} ${body}`).toContain(res.status());
    return body ? JSON.parse(body) : (undefined as T);
  }

  async login(email: string): Promise<void> {
    await this.json(await this.send('post', '/auth/login', { email, password: PASSWORD }));
  }
}

/** Local calendar date (the browser and this process share a TZ) as YYYY-MM-DD, for <input type=date>. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Reads the invitation email the API sent to Mailpit (SMTP 1025 / HTTP 8025) and returns the accept-invitation URL. */
export async function inviteLinkFor(email: string, mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025'): Promise<string> {
  let link = '';
  await expect
    .poll(
      async () => {
        const list = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
        const id = list.messages?.[0]?.ID;
        if (!id) return '';
        const msg = await (await fetch(`${mailpit}/api/v1/message/${id}`)).json();
        link = String(msg.Text + msg.HTML).match(/https?:\/\/[^\s"'<>]+\/accept-invitation\/[^\s"'<>]+/)?.[0] ?? '';
        return link;
      },
      { timeout: 30_000 },
    )
    .not.toBe('');
  return link.replace(/&amp;/g, '&');
}

/** The dev SMS outbox as exposed by the API (console provider), newest first. */
export async function smsOutbox(api: Api, interventionId: string): Promise<Array<{ kind: string; body: string; to: string; status: string; provider: string }>> {
  const all = await api.json<any[]>(await api.get('/dev/sms'));
  return all.filter((n) => n.interventionId === interventionId);
}

/** Posts one location fix (what the PWA does every >=5 s while EN_ROUTE). */
export async function postFix(techApi: Api, id: string, lat: number, lng: number, at = new Date()): Promise<APIResponse> {
  return techApi.send('post', `/tech/interventions/${id}/location`, { lat, lng, accuracy: 15, timestamp: at.toISOString() });
}

export { URLS };
