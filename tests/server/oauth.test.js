import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { loginAs } from './helpers/auth.js';
import { adminIdentity, auditLog, oauthFlows, sessions } from '../../server/db/schema.js';
import { SESSION_COOKIE } from '../../server/services/sessions.js';
import { sha256 } from '../../server/lib/crypto.js';

const MIN = 60_000;
const ORIGIN = 'https://example.test';
const ADMIN = 'jonnhyortega@gmail.com';
const SUB = 'google-sub-123';

// Inicia el flujo y devuelve state y nonce que el backend envió a Google.
async function startFlow(ctx) {
  const res = await request(ctx.app).get('/api/auth/google/start');
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location);
  return { state: url.searchParams.get('state'), nonce: url.searchParams.get('nonce') };
}

// Flujo completo: start → Google devuelve la identidad → callback.
async function login(ctx, identity = {}, { cookie } = {}) {
  const { state, nonce } = await startFlow(ctx);
  ctx.google.setNextIdentity({ sub: SUB, email: ADMIN, emailVerified: true, nonce, ...identity });
  const req = request(ctx.app).get('/api/auth/google/callback').query({ code: 'auth-code', state });
  if (cookie) req.set('Cookie', cookie);
  return { res: await req, state };
}

function sessionCookie(res) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

async function auditEvents(ctx) {
  return ctx.db.select().from(auditLog).orderBy(auditLog.createdAt);
}

async function expectRejected(ctx, res, reason) {
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/__panel-return?error=1');
  expect(sessionCookie(res)).toBeUndefined();
  const events = await auditEvents(ctx);
  const last = events.at(-1);
  expect(last.event).toBe('login_rejected');
  expect(last.meta).toEqual({ reason });
}

describe('GET /api/auth/google/start', () => {
  it('302 a Google con PKCE S256 y state; guarda un flujo', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(302);
    expect(res.headers.location.startsWith('https://accounts.google.com/o/oauth2/v2/auth')).toBe(true);
    const url = new URL(res.headers.location);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();

    const rows = await ctx.db.select().from(oauthFlows);
    expect(rows).toHaveLength(1);
    expect(rows[0].stateHash).toBe(sha256(state));
    // El challenge enviado corresponde al verifier guardado.
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(rows[0].codeVerifier).digest('base64url'),
    );
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('11 start en un minuto desde la misma IP → 429', async () => {
    const ctx = await buildTestApp();
    for (let i = 0; i < 10; i++) {
      const ok = await request(ctx.app).get('/api/auth/google/start');
      expect(ok.status).toBe(302);
    }
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
  });

  it('el límite de login también cuenta los callback', async () => {
    const ctx = await buildTestApp();
    for (let i = 0; i < 10; i++) {
      await request(ctx.app).get('/api/auth/google/callback').query({ code: 'x', state: 'y' });
    }
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(429);
  });

  it('con isProduction=false → 404 genérico', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false, vercelEnv: 'preview' } });
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    const cb = await request(ctx.app).get('/api/auth/google/callback').query({ code: 'x', state: 'y' });
    expect(cb.status).toBe(404);
  });
});

describe('GET /api/auth/google/callback', () => {
  it('feliz → 302 a /__panel-return, cookie de sesión full, login_success y sub guardado', async () => {
    const ctx = await buildTestApp();
    const { res } = await login(ctx);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/__panel-return');
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=28800/);

    // El code_verifier del flujo es el que se usa en el intercambio.
    expect(ctx.google.exchanges).toHaveLength(1);
    expect(ctx.google.exchanges[0].code).toBe('auth-code');

    const events = await auditEvents(ctx);
    expect(events.map((e) => e.event)).toEqual(['login_success']);
    expect(events[0].ipHash).toMatch(/^[0-9a-f]{64}$/);

    const identities = await ctx.db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ email: ADMIN, googleSub: SUB });

    const me = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body.kind).toBe('full');
  });

  it('completa google_sub de una identidad existente sin sub', async () => {
    const ctx = await buildTestApp();
    await ctx.db.insert(adminIdentity).values({ email: ADMIN, googleSub: null });
    const { res } = await login(ctx);
    expect(res.headers.location).toBe('/__panel-return');
    const identities = await ctx.db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0].googleSub).toBe(SUB);
  });

  it('mismo state usado dos veces → segundo intento rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const { res, state } = await login(ctx);
    expect(res.headers.location).toBe('/__panel-return');
    const again = await request(ctx.app).get('/api/auth/google/callback').query({ code: 'auth-code', state });
    await expectRejected(ctx, again, 'invalid_state');
  });

  it('state desconocido → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    await startFlow(ctx);
    const res = await request(ctx.app)
      .get('/api/auth/google/callback')
      .query({ code: 'auth-code', state: 'desconocido' });
    await expectRejected(ctx, res, 'invalid_state');
    expect(ctx.google.exchanges).toHaveLength(0);
  });

  it('sin state → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).get('/api/auth/google/callback').query({ code: 'auth-code' });
    await expectRejected(ctx, res, 'invalid_state');
  });

  it('state expirado (6 min) → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const { state, nonce } = await startFlow(ctx);
    ctx.google.setNextIdentity({ sub: SUB, email: ADMIN, emailVerified: true, nonce });
    ctx.clock.advance(6 * MIN);
    const res = await request(ctx.app).get('/api/auth/google/callback').query({ code: 'auth-code', state });
    await expectRejected(ctx, res, 'invalid_state');
  });

  it('Google devuelve error (sin code) → rechazado sin repetir el texto de Google', async () => {
    const ctx = await buildTestApp();
    const { state } = await startFlow(ctx);
    const res = await request(ctx.app)
      .get('/api/auth/google/callback')
      .query({ error: 'access_denied', error_description: 'TEXTO-DE-GOOGLE', state });
    await expectRejected(ctx, res, 'exchange_failed');
    expect(res.text).not.toContain('TEXTO-DE-GOOGLE');
    expect(res.text).not.toContain('access_denied');
  });

  it('exchangeCode falla → rechazado (exchange_failed)', async () => {
    const ctx = await buildTestApp();
    ctx.google.failExchange();
    const { res } = await login(ctx);
    await expectRejected(ctx, res, 'exchange_failed');
  });

  it('verifyIdToken lanza → rechazado (invalid_token)', async () => {
    const ctx = await buildTestApp();
    ctx.google.failVerify();
    const { res } = await login(ctx);
    await expectRejected(ctx, res, 'invalid_token');
  });

  it('nonce que no coincide con el del flujo → rechazado (invalid_token)', async () => {
    const ctx = await buildTestApp();
    const { res } = await login(ctx, { nonce: 'otro-nonce' });
    await expectRejected(ctx, res, 'invalid_token');
  });

  it('email otro@gmail.com → rechazado sin cookie (email_not_allowed)', async () => {
    const ctx = await buildTestApp();
    const { res } = await login(ctx, { email: 'otro@gmail.com' });
    await expectRejected(ctx, res, 'email_not_allowed');
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    expect(await ctx.db.select().from(adminIdentity)).toHaveLength(0);
  });

  it('email en mayúsculas con emailVerified true → aceptado', async () => {
    const ctx = await buildTestApp();
    const { res } = await login(ctx, { email: 'JonnhyOrtega@Gmail.com' });
    expect(res.headers.location).toBe('/__panel-return');
    expect(sessionCookie(res)).toBeDefined();
  });

  it('emailVerified false → rechazado (email_not_verified)', async () => {
    const ctx = await buildTestApp();
    const { res } = await login(ctx, { emailVerified: false });
    await expectRejected(ctx, res, 'email_not_verified');
  });

  it('segundo login con sub distinto → rechazado (sub_mismatch)', async () => {
    const ctx = await buildTestApp();
    const first = await login(ctx);
    expect(first.res.headers.location).toBe('/__panel-return');
    const { res } = await login(ctx, { sub: 'otro-sub' });
    await expectRejected(ctx, res, 'sub_mismatch');
    const identities = await ctx.db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0].googleSub).toBe(SUB);
  });

  it('segundo login con el mismo sub → aceptado', async () => {
    const ctx = await buildTestApp();
    await login(ctx);
    const { res } = await login(ctx);
    expect(res.headers.location).toBe('/__panel-return');
  });

  it('login con una sesión previa en la cookie → la borra y emite un token nuevo', async () => {
    const ctx = await buildTestApp();
    const previous = await loginAs(ctx, 'recovery');
    const { res } = await login(ctx, {}, { cookie: previous.cookie });
    expect(res.headers.location).toBe('/__panel-return');

    const cookie = sessionCookie(res);
    expect(cookie.split(';')[0]).not.toBe(previous.cookie);
    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('full');
    expect(rows[0].tokenHash).not.toBe(sha256(previous.token));
  });

  it('el audit nunca guarda code ni tokens', async () => {
    const ctx = await buildTestApp();
    await login(ctx);
    ctx.google.failVerify();
    await login(ctx);
    const dump = JSON.stringify(await auditEvents(ctx));
    expect(dump).not.toContain('auth-code');
    expect(dump).not.toContain('fake-id-token');
  });
});

describe('POST /api/auth/logout', () => {
  it('204, limpia la cookie, registra logout y la sesión ya no sirve', async () => {
    const ctx = await buildTestApp();
    const { cookie, csrf } = await loginAs(ctx, 'full');
    const res = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Max-Age=0/);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);

    const events = await auditEvents(ctx);
    expect(events.map((e) => e.event)).toEqual(['logout']);

    const me = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(me.status).toBe(404);
  });

  it('admite sesión recovery', async () => {
    const ctx = await buildTestApp();
    const { cookie, csrf } = await loginAs(ctx, 'recovery');
    const res = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(204);
  });

  it('sin CSRF → 403 y la sesión sigue viva', async () => {
    const ctx = await buildTestApp();
    const { cookie, token } = await loginAs(ctx, 'full');
    const res = await request(ctx.app).post('/api/auth/logout').set('Cookie', cookie).set('Origin', ORIGIN);
    expect(res.status).toBe(403);
    const rows = await ctx.db.select().from(sessions).where(eq(sessions.tokenHash, sha256(token)));
    expect(rows).toHaveLength(1);
  });

  it('sin sesión → 404 genérico', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).post('/api/auth/logout').set('Origin', ORIGIN);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
