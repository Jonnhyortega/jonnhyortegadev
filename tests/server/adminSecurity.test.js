import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { loginAs } from './helpers/auth.js';
import { recordAudit } from '../../server/services/audit.js';
import { adminIdentity, auditLog, sessions } from '../../server/db/schema.js';

const ORIGIN = 'https://example.test';
const CODE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

async function setup(kind = 'full') {
  const ctx = await buildTestApp();
  const session = await loginAs(ctx, kind);
  const call = (method, url, { s = session } = {}) =>
    request(ctx.app)[method](url).set('Cookie', s.cookie).set('Origin', ORIGIN).set('X-CSRF-Token', s.csrf);
  return { ...ctx, session, call };
}

describe('admin security: auditoría', () => {
  it('lista eventos sin ipHash, más recientes primero', async () => {
    const { call, db, clock } = await setup();
    await recordAudit(db, { event: 'a', ipHash: 'secret-hash', userAgent: 'ua', meta: { x: 1 }, now: clock.now() });
    clock.advance(1000);
    await recordAudit(db, { event: 'b', ipHash: 'secret-hash', userAgent: 'ua', now: clock.now() });

    const res = await call('get', '/api/admin/security/audit');
    expect(res.status).toBe(200);
    expect(res.body.map((e) => e.event)).toEqual(['b', 'a']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['createdAt', 'event', 'meta']);
    expect(JSON.stringify(res.body)).not.toContain('secret-hash');
  });

  it('con sesión recovery: 404', async () => {
    const { call } = await setup('recovery');
    const res = await call('get', '/api/admin/security/audit');
    expect(res.status).toBe(404);
  });
});

describe('admin security: sesiones', () => {
  it('GET lista sesiones marcando la actual y sin datos secretos', async () => {
    const { call, db, clock, session } = await setup();
    await loginAs({ db, clock }, 'full');
    const res = await call('get', '/api/admin/security/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.filter((s) => s.current)).toHaveLength(1);
    for (const s of res.body) {
      expect(Object.keys(s).sort()).toEqual(['createdAt', 'current', 'id', 'kind', 'lastSeenAt', 'userAgent']);
    }
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(session.token);
    expect(text).not.toContain(session.csrf);
  });

  it('DELETE borra todas, limpia la cookie, audita y responde 204', async () => {
    const { call, db, clock, session } = await setup();
    const other = await loginAs({ db, clock }, 'full');
    const res = await call('delete', '/api/admin/security/sessions');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/__Host-session=;.*(Max-Age=0|Expires=)/);

    expect((await call('get', '/api/admin/me', { s: other })).status).toBe(404);
    expect((await call('get', '/api/admin/me', { s: session })).status).toBe(404);

    const events = await db.select().from(auditLog).where(eq(auditLog.event, 'sessions_revoked'));
    expect(events).toHaveLength(1);
    expect(events[0].meta).toEqual({ count: 2 });
  });
});

describe('admin security: códigos de recuperación', () => {
  it('sesión full: 10 códigos, no-store y auditoría sin códigos', async () => {
    const { call, db } = await setup();
    const res = await call('post', '/api/admin/security/recovery-codes');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.codes).toHaveLength(10);
    for (const c of res.body.codes) expect(c).toMatch(CODE);

    const events = await db.select().from(auditLog).where(eq(auditLog.event, 'recovery_codes_generated'));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain(res.body.codes[0]);
    // la sesión full sigue viva
    expect((await call('get', '/api/admin/me')).status).toBe(200);
  });

  it('sesión recovery: 10 códigos y la sesión queda invalidada', async () => {
    const { call, db } = await setup('recovery');
    const res = await call('post', '/api/admin/security/recovery-codes');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.codes).toHaveLength(10);
    expect(res.headers['set-cookie'].join(';')).toMatch(/__Host-session=;/);

    expect((await call('get', '/api/admin/me')).status).toBe(404);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('sin CSRF: 403', async () => {
    const { session, app } = await setup();
    const res = await request(app)
      .post('/api/admin/security/recovery-codes')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN);
    expect(res.status).toBe(403);
  });
});

describe('admin security: desvincular Google (sesión recovery)', () => {
  const URL = '/api/admin/security/identity/reset';
  const ADMIN = 'jonnhyortega@gmail.com';

  it('recovery: 204, borra el sub, fija el email de ADMIN_EMAIL, audita y cierra la sesión', async () => {
    const { call, db } = await setup('recovery');
    await db.insert(adminIdentity).values({ email: 'viejo@gmail.com', googleSub: 'sub-viejo' });

    const res = await call('post', URL);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/__Host-session=;.*Max-Age=0/);

    const identities = await db.select().from(adminIdentity);
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({ email: ADMIN, googleSub: null });

    const events = await db.select().from(auditLog).where(eq(auditLog.event, 'identity_reset'));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain('sub-viejo');
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect((await call('get', '/api/admin/me')).status).toBe(404);
  });

  it('sesión full: 404 genérico y la identidad no cambia', async () => {
    const { call, db } = await setup('full');
    await db.insert(adminIdentity).values({ email: ADMIN, googleSub: 'sub-actual' });
    const res = await call('post', URL);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    const [identity] = await db.select().from(adminIdentity);
    expect(identity.googleSub).toBe('sub-actual');
  });

  it('anónimo: 404 genérico', async () => {
    const { app } = await setup();
    const res = await request(app).post(URL).set('Origin', ORIGIN);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('recovery sin CSRF: 403 y la identidad no cambia', async () => {
    const { app, db, session } = await setup('recovery');
    await db.insert(adminIdentity).values({ email: ADMIN, googleSub: 'sub-actual' });
    const res = await request(app).post(URL).set('Cookie', session.cookie).set('Origin', ORIGIN);
    expect(res.status).toBe(403);
    const [identity] = await db.select().from(adminIdentity);
    expect(identity.googleSub).toBe('sub-actual');
    expect(await db.select().from(sessions)).toHaveLength(1);
  });
});
