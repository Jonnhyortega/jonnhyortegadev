import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { loginAs } from './helpers/auth.js';
import { adminIdentity, auditLog, oauthFlows, sessions } from '../../server/db/schema.js';
import { SESSION_COOKIE } from '../../server/services/sessions.js';
import { sha256 } from '../../server/lib/crypto.js';
import { verifyPanelReturn } from '../../server/lib/panelReturn.js';

const MIN = 60_000;
const ORIGIN = 'https://example.test';
const ADMIN = 'jonnhyortega@gmail.com';
const SUB = 'google-sub-123';
const OAUTH_COOKIE = '__Host-oauth';

afterEach(() => {
  vi.restoreAllMocks();
});

function findCookie(res, name) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));
}

function sessionCookie(res) {
  return findCookie(res, SESSION_COOKIE);
}

// Inicia el flujo y devuelve state, nonce y la cookie que liga el flujo al navegador.
async function startFlow(ctx) {
  const res = await request(ctx.app).get('/api/auth/google/start');
  expect(res.status).toBe(302);
  const url = new URL(res.headers.location);
  const binding = findCookie(res, OAUTH_COOKIE);
  expect(binding).toBeDefined();
  return {
    state: url.searchParams.get('state'),
    nonce: url.searchParams.get('nonce'),
    bindingCookie: binding.split(';')[0],
  };
}

function callback(ctx, query, cookies = []) {
  const req = request(ctx.app).get('/api/auth/google/callback').query(query);
  if (cookies.length > 0) req.set('Cookie', cookies.join('; '));
  return req;
}

// Flujo completo: start → Google devuelve la identidad → callback, con la
// cookie de binding que dejó start (o `binding` si se indica; null = sin ella).
async function login(ctx, identity = {}, { cookie, binding } = {}) {
  const { state, nonce, bindingCookie } = await startFlow(ctx);
  ctx.google.setNextIdentity({ sub: SUB, email: ADMIN, emailVerified: true, nonce, ...identity });
  const cookies = [binding === undefined ? bindingCookie : binding, cookie].filter(Boolean);
  const res = await callback(ctx, { code: 'auth-code', state }, cookies);
  return { res, state, bindingCookie };
}

async function auditEvents(ctx) {
  return ctx.db.select().from(auditLog).orderBy(auditLog.createdAt);
}

function expectOauthCookieCleared(res) {
  const cleared = findCookie(res, OAUTH_COOKIE);
  expect(cleared).toBeDefined();
  expect(cleared).toMatch(/^__Host-oauth=;/);
  expect(cleared).toMatch(/Max-Age=0/);
  expect(cleared).toMatch(/HttpOnly/);
  expect(cleared).toMatch(/Secure/);
  expect(cleared).toMatch(/SameSite=Lax/);
  expect(cleared).toMatch(/Path=\//);
}

async function expectPanelReturnCookie(res, ctx) {
  const cookie = findCookie(res, '__Host-panel-return');
  expect(cookie).toBeDefined();
  expect(cookie).toMatch(/^__Host-panel-return=\d+\.[A-Za-z0-9_-]{43};/);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Secure/);
  expect(cookie).toMatch(/SameSite=Lax/);
  expect(cookie).toMatch(/Path=\//);
  expect(cookie).toMatch(/Max-Age=120/);
  expect(cookie).not.toMatch(/Domain=/i);
  const value = cookie.split(';')[0].slice('__Host-panel-return='.length);
  expect(await verifyPanelReturn(ctx.env.panelReturnSecret, value, ctx.clock.now().getTime())).toBe(true);
  expect(await verifyPanelReturn('otro-secreto-otro-secreto-otro-secreto-12', value, ctx.clock.now().getTime())).toBe(false);
}

// Un rechazo nunca emite la cookie de retorno al panel: sin ella,
// /__panel-return no revela la ruta secreta (R37).
function expectNoPanelReturnCookie(res) {
  expect(findCookie(res, '__Host-panel-return')).toBeUndefined();
}

async function expectRejected(ctx, res, reason) {
  expect(res.status).toBe(302);
  expect(res.headers.location).toBe('/');
  expect(sessionCookie(res)).toBeUndefined();
  expectOauthCookieCleared(res);
  expectNoPanelReturnCookie(res);
  // Todos los eventos del test comparten la hora del reloj falso: se compara
  // el conjunto de motivos de rechazo, no el orden.
  const reasons = (await auditEvents(ctx))
    .filter((e) => e.event === 'login_rejected')
    .map((e) => e.meta);
  expect(reasons).toContainEqual({ reason });
}

describe('GET /api/auth/google/start', () => {
  it('302 a Google con PKCE S256 y state; guarda un flujo y fija la cookie de binding', async () => {
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

    const binding = findCookie(res, OAUTH_COOKIE);
    expect(binding).toMatch(/HttpOnly/);
    expect(binding).toMatch(/Secure/);
    expect(binding).toMatch(/SameSite=Lax/);
    expect(binding).toMatch(/Path=\//);
    expect(binding).toMatch(/Max-Age=300/);
    expect(binding).not.toMatch(/Domain=/i);
    const value = binding.split(';')[0].slice(`${OAUTH_COOKIE}=`.length);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rows[0].bindingHash).toBe(sha256(value));
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
      await callback(ctx, { code: 'x', state: 'y' });
    }
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(429);
  });

  it('con isProduction=false → 404 genérico', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false, vercelEnv: 'preview' } });
    const res = await request(ctx.app).get('/api/auth/google/start');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    const cb = await callback(ctx, { code: 'x', state: 'y' });
    expect(cb.status).toBe(404);
  });
});

describe('GET /api/auth/google/callback', () => {
  it('feliz → 302 a /__panel-return, cookie de sesión full, login_success, sub guardado y binding borrado', async () => {
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
    expectOauthCookieCleared(res);
    await expectPanelReturnCookie(res, ctx);

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
    const { res, state, bindingCookie } = await login(ctx);
    expect(res.headers.location).toBe('/__panel-return');
    const again = await callback(ctx, { code: 'auth-code', state }, [bindingCookie]);
    await expectRejected(ctx, again, 'invalid_state');
  });

  it('state desconocido → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const { bindingCookie } = await startFlow(ctx);
    const res = await callback(ctx, { code: 'auth-code', state: 'desconocido' }, [bindingCookie]);
    await expectRejected(ctx, res, 'invalid_state');
    expect(ctx.google.exchanges).toHaveLength(0);
  });

  it('sin state → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const { bindingCookie } = await startFlow(ctx);
    const res = await callback(ctx, { code: 'auth-code' }, [bindingCookie]);
    await expectRejected(ctx, res, 'invalid_state');
  });

  it('state expirado (6 min) → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const { state, nonce, bindingCookie } = await startFlow(ctx);
    ctx.google.setNextIdentity({ sub: SUB, email: ADMIN, emailVerified: true, nonce });
    ctx.clock.advance(6 * MIN);
    const res = await callback(ctx, { code: 'auth-code', state }, [bindingCookie]);
    await expectRejected(ctx, res, 'invalid_state');
  });

  it('callback sin la cookie de binding → rechazado (invalid_state), sin sesión y flujo consumido', async () => {
    const ctx = await buildTestApp();
    const { res, state, bindingCookie } = await login(ctx, {}, { binding: null });
    await expectRejected(ctx, res, 'invalid_state');
    expect(ctx.google.exchanges).toHaveLength(0);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    // El flujo ya se consumió: ni con la cookie correcta sirve después.
    const retry = await callback(ctx, { code: 'auth-code', state }, [bindingCookie]);
    await expectRejected(ctx, retry, 'invalid_state');
    expect(sessionCookie(retry)).toBeUndefined();
  });

  it('callback con otra cookie de binding (de otro start) → rechazado (invalid_state)', async () => {
    const ctx = await buildTestApp();
    const other = await startFlow(ctx);
    const { res } = await login(ctx, {}, { binding: other.bindingCookie });
    await expectRejected(ctx, res, 'invalid_state');
    expect(ctx.google.exchanges).toHaveLength(0);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it('Google devuelve error (sin code) → rechazado sin repetir el texto de Google', async () => {
    const ctx = await buildTestApp();
    const { state, bindingCookie } = await startFlow(ctx);
    const res = await callback(
      ctx,
      { error: 'access_denied', error_description: 'TEXTO-DE-GOOGLE', state },
      [bindingCookie],
    );
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

  it('tras desvincular Google con una sesión recovery, un login con un sub nuevo vuelve a vincular', async () => {
    const ctx = await buildTestApp();
    await login(ctx);
    const recovery = await loginAs(ctx, 'recovery');
    const reset = await request(ctx.app)
      .post('/api/admin/security/identity/reset')
      .set('Cookie', recovery.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', recovery.csrf);
    expect(reset.status).toBe(204);

    const { res } = await login(ctx, { sub: 'sub-nuevo' });
    expect(res.headers.location).toBe('/__panel-return');
    expect(sessionCookie(res)).toBeDefined();
    const identities = await ctx.db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ email: ADMIN, googleSub: 'sub-nuevo' });
  });

  it('ADMIN_EMAIL cambió sin desvincular → rechazado (email_changed) y la identidad no cambia', async () => {
    const ctx = await buildTestApp();
    await ctx.db.insert(adminIdentity).values({ email: 'viejo@gmail.com', googleSub: SUB });
    const { res } = await login(ctx);
    await expectRejected(ctx, res, 'email_changed');
    const identities = await ctx.db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ email: 'viejo@gmail.com', googleSub: SUB });
  });

  it('ADMIN_EMAIL cambió y la identidad no tiene sub → también email_changed (no se revincula en silencio)', async () => {
    const ctx = await buildTestApp();
    await ctx.db.insert(adminIdentity).values({ email: 'viejo@gmail.com', googleSub: null });
    const { res } = await login(ctx);
    await expectRejected(ctx, res, 'email_changed');
    const [identity] = await ctx.db.select().from(adminIdentity);
    expect(identity.googleSub).toBeNull();
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

  it('si falla el audit de login_success → sin cookie de sesión, sin sesión y redirección de error', async () => {
    const ctx = await buildTestApp();
    await ctx.db.execute(
      sql`alter table audit_log add constraint test_no_login_success check (event <> 'login_success')`,
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = await login(ctx);
    await expectRejected(ctx, res, 'internal_error');
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    const events = await auditEvents(ctx);
    expect(events.map((e) => e.event)).toEqual(['login_rejected']);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('error inesperado de BD → 302 de error, limpia __Host-oauth, internal_error y log solo con id y stack', async () => {
    const ctx = await buildTestApp();
    const { state, nonce, bindingCookie } = await startFlow(ctx);
    ctx.google.setNextIdentity({ sub: SUB, email: ADMIN, emailVerified: true, nonce });
    await ctx.db.execute(sql`drop table oauth_flows`);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await callback(ctx, { code: 'auth-code', state }, [bindingCookie]);
    await expectRejected(ctx, res, 'internal_error');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [prefix, stack, ...rest] = errorSpy.mock.calls[0];
    expect(prefix).toBe(`[${res.headers['x-request-id']}]`);
    expect(typeof stack).toBe('string');
    expect(rest).toEqual([]);
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(state);
    expect(logged).not.toContain(bindingCookie.slice(`${OAUTH_COOKIE}=`.length));
  });

  it('si además falla el audit de internal_error → igual redirige a / sin cookie de retorno', async () => {
    const ctx = await buildTestApp();
    const { state, bindingCookie } = await startFlow(ctx);
    await ctx.db.execute(sql`drop table oauth_flows`);
    await ctx.db.execute(sql`drop table audit_log`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await callback(ctx, { code: 'auth-code', state }, [bindingCookie]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expectNoPanelReturnCookie(res);
    expect(sessionCookie(res)).toBeUndefined();
    expectOauthCookieCleared(res);
  });

  it('un callback anónimo sin parámetros no emite la cookie de retorno (no revela la ruta)', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).get('/api/auth/google/callback');
    await expectRejected(ctx, res, 'invalid_state');
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
