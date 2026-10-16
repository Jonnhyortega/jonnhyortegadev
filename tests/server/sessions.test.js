import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { createTestDb } from './helpers/db.js';
import { loginAs } from './helpers/auth.js';
import { sessions } from '../../server/db/schema.js';
import { sha256 } from '../../server/lib/crypto.js';
import {
  SESSION_COOKIE,
  createSession,
  getSession,
  deleteSession,
  deleteAllSessions,
  listSessions,
  setSessionCookie,
  clearSessionCookie,
} from '../../server/services/sessions.js';
import { loadSession, requireSession } from '../../server/middleware/session.js';
import { requireCsrf } from '../../server/middleware/csrf.js';
import { productionOnly } from '../../server/middleware/productionOnly.js';
import { errorHandler, notFoundHandler } from '../../server/middleware/errors.js';

const MIN = 60_000;
const HOUR = 60 * MIN;
const ORIGIN = 'https://example.test';

// Respuesta 404 de referencia: la de una ruta que no existe.
async function genericNotFound(app) {
  return request(app).get('/api/no-existe');
}

function expectSame404(res, reference) {
  expect(res.status).toBe(404);
  expect(reference.status).toBe(404);
  expect(res.text).toBe(reference.text);
  expect(res.headers['content-type']).toBe(reference.headers['content-type']);
  expect(res.body).toEqual({ error: 'not_found' });
}

describe('GET /api/admin/me', () => {
  it('sin cookie → 404 idéntico al genérico', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).get('/api/admin/me');
    expectSame404(res, await genericNotFound(ctx.app));
  });

  it('con cookie válida → 200 con kind, csrfToken y expiresAt', async () => {
    const ctx = await buildTestApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'full',
      csrfToken: csrf,
      expiresAt: new Date(ctx.clock.now().getTime() + 8 * HOUR).toISOString(),
    });
  });

  it('accesible también con sesión recovery', async () => {
    const ctx = await buildTestApp();
    const { cookie } = await loginAs(ctx, 'recovery');
    const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('recovery');
  });

  it('token inexistente o manipulado → 404 idéntico al genérico', async () => {
    const ctx = await buildTestApp();
    const { token } = await loginAs(ctx);
    const reference = await genericNotFound(ctx.app);

    const unknown = await request(ctx.app)
      .get('/api/admin/me')
      .set('Cookie', `${SESSION_COOKIE}=no-existe-este-token`);
    expectSame404(unknown, reference);

    const last = token.at(-1) === 'A' ? 'B' : 'A';
    const tampered = await request(ctx.app)
      .get('/api/admin/me')
      .set('Cookie', `${SESSION_COOKIE}=${token.slice(0, -1)}${last}`);
    expectSame404(tampered, reference);

    // Cookie con otro nombre (sin prefijo __Host-) tampoco sirve.
    const wrongName = await request(ctx.app).get('/api/admin/me').set('Cookie', `session=${token}`);
    expectSame404(wrongName, reference);
  });

  it('con env.isProduction = false → 404 aun con sesión válida', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false, vercelEnv: 'preview' } });
    const { cookie } = await loginAs(ctx);
    const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expectSame404(res, await genericNotFound(ctx.app));
  });
});

describe('caducidad de sesiones', () => {
  it('full: 31 min sin actividad → 404', async () => {
    const ctx = await buildTestApp();
    const { cookie } = await loginAs(ctx);
    ctx.clock.advance(31 * MIN);
    const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('full: con actividad cada 20 min sigue válida hasta las 8 h y luego 404', async () => {
    const ctx = await buildTestApp();
    const { cookie } = await loginAs(ctx);
    // 23 × 20 min = 7 h 40 min.
    for (let i = 0; i < 23; i++) {
      ctx.clock.advance(20 * MIN);
      const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
    }
    ctx.clock.advance(20 * MIN); // 8 h exactas: caducidad absoluta.
    const res = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('recovery: válida a los 14 min, 404 a los 16 min', async () => {
    const ctx = await buildTestApp();
    const { cookie } = await loginAs(ctx, 'recovery');
    ctx.clock.advance(14 * MIN);
    expect((await request(ctx.app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);
    ctx.clock.advance(2 * MIN);
    expect((await request(ctx.app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(404);
  });
});

describe('servicio de sesiones', () => {
  const T0 = new Date('2026-01-01T00:00:00.000Z');

  it('la BD guarda solo el hash del token', async () => {
    const db = await createTestDb();
    const { token, csrfToken, session } = await createSession(db, {
      kind: 'full',
      ipHash: 'h',
      userAgent: 'ua',
      now: T0,
    });
    const [row] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toBe(sha256(token));
    expect(row.csrfSecret).toBe(csrfToken);
    expect(csrfToken).not.toBe(token);
    expect(row.expiresAt).toEqual(new Date(T0.getTime() + 8 * HOUR));
  });

  it('recovery caduca a los 15 min', async () => {
    const db = await createTestDb();
    const { session } = await createSession(db, { kind: 'recovery', now: T0 });
    expect(session.expiresAt).toEqual(new Date(T0.getTime() + 15 * MIN));
  });

  it('rechaza tipos desconocidos', async () => {
    const db = await createTestDb();
    await expect(createSession(db, { kind: 'admin', now: T0 })).rejects.toThrow();
  });

  it('getSession actualiza last_seen_at sin extender expires_at', async () => {
    const db = await createTestDb();
    const { token, session } = await createSession(db, { kind: 'full', now: T0 });
    const later = new Date(T0.getTime() + 10 * MIN);
    const found = await getSession(db, { token, now: later });
    expect(found.id).toBe(session.id);
    const [row] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(row.lastSeenAt).toEqual(later);
    expect(row.expiresAt).toEqual(session.expiresAt);
  });

  it('getSession con token no string o vacío → null', async () => {
    const db = await createTestDb();
    expect(await getSession(db, { token: undefined, now: T0 })).toBeNull();
    expect(await getSession(db, { token: '', now: T0 })).toBeNull();
  });

  it('las sesiones caducadas encontradas se borran', async () => {
    const db = await createTestDb();
    const { token } = await createSession(db, { kind: 'full', now: T0 });
    const later = new Date(T0.getTime() + 31 * MIN);
    expect(await getSession(db, { token, now: later })).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('deleteSession, deleteAllSessions y listSessions', async () => {
    const db = await createTestDb();
    const a = await createSession(db, { kind: 'full', now: T0 });
    const b = await createSession(db, { kind: 'recovery', now: T0 });
    await createSession(db, { kind: 'full', now: T0 });

    const listed = await listSessions(db, T0);
    expect(listed).toHaveLength(3);
    for (const s of listed) {
      expect(s).not.toHaveProperty('tokenHash');
      expect(s).not.toHaveProperty('csrfSecret');
    }
    // La recovery ya caducó a los 16 min: no se lista.
    const later = await listSessions(db, new Date(T0.getTime() + 16 * MIN));
    expect(later.map((s) => s.id).sort()).not.toContain(b.session.id);
    expect(later).toHaveLength(2);

    await deleteSession(db, a.session.id);
    expect(await getSession(db, { token: a.token, now: T0 })).toBeNull();

    expect(await deleteAllSessions(db)).toBe(2);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});

describe('cookie de sesión', () => {
  function cookieApp(handler) {
    const app = express();
    app.get('/c', (req, res) => {
      handler(res);
      res.end();
    });
    return app;
  }

  it('setSessionCookie emite __Host-session HttpOnly; Secure; SameSite=Strict; Path=/ sin Domain', async () => {
    const res = await request(cookieApp((r) => setSessionCookie(r, 'tok', 8 * HOUR))).get('/c');
    const [header] = res.headers['set-cookie'];
    expect(header.startsWith(`${SESSION_COOKIE}=tok;`)).toBe(true);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=28800');
    expect(header.toLowerCase()).not.toContain('domain');
  });

  it('clearSessionCookie vacía la cookie con los mismos atributos y Max-Age=0', async () => {
    const res = await request(cookieApp((r) => clearSessionCookie(r))).get('/c');
    const [header] = res.headers['set-cookie'];
    expect(header.startsWith(`${SESSION_COOKIE}=;`)).toBe(true);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    expect(header.toLowerCase()).not.toContain('domain');
  });
});

describe('requireCsrf (unidad)', () => {
  const env = { appOrigin: ORIGIN };

  // App mínima: loadSession + requireCsrf + POST de prueba.
  async function csrfApp() {
    const db = await createTestDb();
    let current = new Date('2026-01-01T00:00:00.000Z');
    const clock = { now: () => new Date(current) };
    const app = express();
    app.use(loadSession({ db, now: clock.now }));
    app.use(requireCsrf(env));
    app.post('/write', (req, res) => res.json({ ok: true }));
    app.get('/read', (req, res) => res.json({ ok: true }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return { app, db, clock };
  }

  it('sin X-CSRF-Token → 403', async () => {
    const ctx = await csrfApp();
    const { cookie } = await loginAs(ctx);
    const res = await request(ctx.app).post('/write').set('Cookie', cookie).set('Origin', ORIGIN);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('X-CSRF-Token incorrecto → 403', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', `${csrf}x`);
    expect(res.status).toBe(403);
  });

  it('token de otra sesión → 403', async () => {
    const ctx = await csrfApp();
    const { cookie } = await loginAs(ctx);
    const other = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', other.csrf);
    expect(res.status).toBe(403);
  });

  it('Origin ajeno → 403 aunque el token sea correcto', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.test')
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('Origin presente manda sobre un Referer válido', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Origin', 'null')
      .set('Referer', `${ORIGIN}/panel`)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(403);
  });

  it('sin Origin ni Referer → 403', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app).post('/write').set('Cookie', cookie).set('X-CSRF-Token', csrf);
    expect(res.status).toBe(403);
  });

  it('Referer de otro origen o malformado → 403', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    for (const referer of ['https://evil.test/x', 'https://example.test.evil.test/', 'no-es-url']) {
      const res = await request(ctx.app)
        .post('/write')
        .set('Cookie', cookie)
        .set('Referer', referer)
        .set('X-CSRF-Token', csrf);
      expect(res.status).toBe(403);
    }
  });

  it('sin sesión → 403', async () => {
    const ctx = await csrfApp();
    const res = await request(ctx.app).post('/write').set('Origin', ORIGIN).set('X-CSRF-Token', 'x');
    expect(res.status).toBe(403);
  });

  it('Origin y token correctos → 200', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(200);
  });

  it('Referer del mismo origen (sin Origin) y token correcto → 200', async () => {
    const ctx = await csrfApp();
    const { cookie, csrf } = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/write')
      .set('Cookie', cookie)
      .set('Referer', `${ORIGIN}/algo?x=1`)
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(200);
  });

  it('métodos seguros no requieren token', async () => {
    const ctx = await csrfApp();
    const res = await request(ctx.app).get('/read');
    expect(res.status).toBe(200);
  });
});

describe('requireSession y productionOnly (unidad)', () => {
  async function gateApp(...kinds) {
    const db = await createTestDb();
    const clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };
    const app = express();
    app.use(loadSession({ db, now: clock.now }));
    app.get('/x', requireSession(...kinds), (req, res) => res.json({ id: req.session.id }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return { app, db, clock };
  }

  it('requireSession("full") rechaza recovery con 404', async () => {
    const ctx = await gateApp('full');
    const recovery = await loginAs(ctx, 'recovery');
    const res = await request(ctx.app).get('/x').set('Cookie', recovery.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });

    const full = await loginAs(ctx, 'full');
    expect((await request(ctx.app).get('/x').set('Cookie', full.cookie)).status).toBe(200);
  });

  it('productionOnly → 404 fuera de producción', async () => {
    const make = (isProduction) => {
      const app = express();
      app.get('/p', productionOnly({ isProduction }), (req, res) => res.json({ ok: true }));
      app.use(errorHandler);
      return app;
    };
    expect((await request(make(false)).get('/p')).status).toBe(404);
    expect((await request(make(true)).get('/p')).status).toBe(200);
  });
});

describe('router admin: CSRF y límite de escrituras', () => {
  it('POST sin X-CSRF-Token → 403; con Origin ajeno → 403; con ambos correctos → no 403', async () => {
    const ctx = await buildTestApp();
    const { cookie, csrf } = await loginAs(ctx);

    const noToken = await request(ctx.app)
      .post('/api/admin/prueba')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN);
    expect(noToken.status).toBe(403);

    const evil = await request(ctx.app)
      .post('/api/admin/prueba')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.test')
      .set('X-CSRF-Token', csrf);
    expect(evil.status).toBe(403);

    const ok = await request(ctx.app)
      .post('/api/admin/prueba')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', csrf);
    expect(ok.status).not.toBe(403);
    expect(ok.status).toBe(404);
  });

  it('POST sin sesión → 404 (no revela la existencia del router)', async () => {
    const ctx = await buildTestApp();
    const res = await request(ctx.app).post('/api/admin/prueba').set('Origin', ORIGIN);
    expect(res.status).toBe(404);
  });

  it('60 escrituras por minuto por sesión; la 61ª → 429; las lecturas no cuentan', async () => {
    const ctx = await buildTestApp();
    const { cookie, csrf } = await loginAs(ctx);
    const write = () =>
      request(ctx.app)
        .post('/api/admin/prueba')
        .set('Cookie', cookie)
        .set('Origin', ORIGIN)
        .set('X-CSRF-Token', csrf);

    for (let i = 0; i < 5; i++) {
      expect((await request(ctx.app).get('/api/admin/me').set('Cookie', cookie)).status).toBe(200);
    }
    for (let i = 0; i < 60; i++) expect((await write()).status).toBe(404);
    const limited = await write();
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'rate_limited' });

    // Otra sesión tiene su propio contador.
    const other = await loginAs(ctx);
    const res = await request(ctx.app)
      .post('/api/admin/prueba')
      .set('Cookie', other.cookie)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', other.csrf);
    expect(res.status).toBe(404);
  });
});
