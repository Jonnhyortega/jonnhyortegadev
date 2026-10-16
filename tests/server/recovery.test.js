import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { createTestDb } from './helpers/db.js';
import { auditLog, rateLimits, recoveryCodes, sessions } from '../../server/db/schema.js';
import { SESSION_COOKIE } from '../../server/services/sessions.js';
import {
  consumeRecoveryCode,
  generateRecoveryCodes,
  normalizeCode,
} from '../../server/services/recoveryCodes.js';
import { recoveryRequestSchema } from '../../server/schemas/auth.js';
import { requireSameOrigin } from '../../server/middleware/csrf.js';
import { notFoundHandler, errorHandler } from '../../server/middleware/errors.js';

const MIN = 60_000;
const ORIGIN = 'https://example.test';
const CODE_FORMAT = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
// Código con formato válido que nunca se genera en estos tests (no está en la BD).
const WRONG_CODE = 'ZZZZ-ZZZZ-ZZZZ';

function recover(ctx, body, { ip = '203.0.113.1', origin = ORIGIN } = {}) {
  const req = request(ctx.app).post('/api/auth/recovery').set('X-Forwarded-For', ip);
  if (origin !== null) req.set('Origin', origin);
  return req.send(body);
}

function sessionCookie(res) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

async function events(ctx, name) {
  return ctx.db.select().from(auditLog).where(eq(auditLog.event, name));
}

async function globalLockRow(ctx) {
  const [row] = await ctx.db.select().from(rateLimits).where(eq(rateLimits.key, 'recovery:global'));
  return row;
}

// 10 fallos desde IPs distintas: activa el bloqueo global de 15 min.
async function failFromTenIps(ctx) {
  for (let i = 0; i < 10; i++) {
    const res = await recover(ctx, { code: WRONG_CODE }, { ip: `198.51.100.${i + 1}` });
    expect(res.status).toBe(401);
  }
}

describe('normalizeCode', () => {
  it('pasa a mayúsculas y quita guiones y espacios', () => {
    expect(normalizeCode('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(normalizeCode(' abcd efgh jkmn ')).toBe('ABCDEFGHJKMN');
  });

  it('mapea O→0 e I/L→1', () => {
    expect(normalizeCode('OOOO-IIII-LLLL')).toBe('000011111111');
  });

  it("devuelve '' si no quedan 12 caracteres Crockford", () => {
    expect(normalizeCode('ABCD-EFGH-JKM')).toBe('');
    expect(normalizeCode('ABCD-EFGH-JKMNP')).toBe('');
    expect(normalizeCode('ABCD-EFGH-JKMU')).toBe('');
    expect(normalizeCode('ABCD_EFGH_JKMN')).toBe('');
    expect(normalizeCode('')).toBe('');
  });
});

describe('recoveryRequestSchema', () => {
  it('rechaza campos extra y códigos vacíos o largos', () => {
    expect(recoveryRequestSchema.safeParse({ code: 'x' }).success).toBe(true);
    expect(recoveryRequestSchema.safeParse({ code: 'x', admin: true }).success).toBe(false);
    expect(recoveryRequestSchema.safeParse({ code: '' }).success).toBe(false);
    expect(recoveryRequestSchema.safeParse({ code: 'x'.repeat(33) }).success).toBe(false);
  });
});

describe('generateRecoveryCodes / consumeRecoveryCode', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('devuelve 10 códigos únicos XXXX-XXXX-XXXX y la BD solo guarda hashes argon2id', async () => {
    const db = await createTestDb();
    const codes = await generateRecoveryCodes(db, now);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(CODE_FORMAT);

    const rows = await db.select().from(recoveryCodes);
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      expect(row.codeHash.startsWith('$argon2id$')).toBe(true);
      expect(row.codeHash).toContain('m=19456,t=2,p=1');
      expect(row.usedAt).toBeNull();
      for (const code of codes) {
        expect(row.codeHash).not.toContain(code);
        expect(row.codeHash).not.toContain(code.replaceAll('-', ''));
      }
    }
  });

  it('regenerar borra los anteriores', async () => {
    const db = await createTestDb();
    const first = await generateRecoveryCodes(db, now);
    await generateRecoveryCodes(db, now);
    expect(await db.select().from(recoveryCodes)).toHaveLength(10);
    expect(await consumeRecoveryCode(db, { code: first[0], now })).toBe(false);
  });

  it('un código se consume una sola vez y marca used_at', async () => {
    const db = await createTestDb();
    const [code] = await generateRecoveryCodes(db, now);
    expect(await consumeRecoveryCode(db, { code, now })).toBe(true);
    expect(await consumeRecoveryCode(db, { code, now })).toBe(false);
    const used = (await db.select().from(recoveryCodes)).filter((r) => r.usedAt !== null);
    expect(used).toHaveLength(1);
    expect(used[0].usedAt.toISOString()).toBe(now.toISOString());
  });
});

describe('requireSameOrigin (unidad)', () => {
  function originApp() {
    const app = express();
    app.post('/write', requireSameOrigin({ appOrigin: ORIGIN }), (req, res) => res.json({ ok: true }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
  }

  it('Origin propio → pasa; ajeno, "null" o ausente → 403', async () => {
    const app = originApp();
    expect((await request(app).post('/write').set('Origin', ORIGIN)).status).toBe(200);
    expect((await request(app).post('/write').set('Referer', `${ORIGIN}/x`)).status).toBe(200);
    for (const origin of ['https://evil.test', 'null']) {
      const res = await request(app).post('/write').set('Origin', origin);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'forbidden' });
    }
    expect((await request(app).post('/write')).status).toBe(403);
  });
});

describe('POST /api/auth/recovery', () => {
  it('código válido → 200, sesión recovery de 15 min; el mismo código otra vez → 401', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());

    const res = await recover(ctx, { code });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/Max-Age=900/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const rows = await ctx.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('recovery');
    expect(rows[0].expiresAt.getTime() - ctx.clock.now().getTime()).toBe(15 * MIN);
    expect(await events(ctx, 'recovery_success')).toHaveLength(1);

    const again = await recover(ctx, { code });
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: 'invalid_code' });
    expect(sessionCookie(again)).toBeUndefined();
    expect(await events(ctx, 'recovery_failed')).toHaveLength(1);
  });

  it('la sesión recovery abre /api/admin/me pero no /api/admin/translations (404)', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const res = await recover(ctx, { code });
    const cookie = sessionCookie(res).split(';')[0];

    const me = await request(ctx.app).get('/api/admin/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.kind).toBe('recovery');

    const translations = await request(ctx.app).get('/api/admin/translations').set('Cookie', cookie);
    expect(translations.status).toBe(404);
    expect(translations.body).toEqual({ error: 'not_found' });
  });

  it('acepta el código en minúsculas y sin guiones', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const res = await recover(ctx, { code: code.replaceAll('-', '').toLowerCase() });
    expect(res.status).toBe(200);
  });

  it('tras regenerar, los códigos anteriores dan 401', async () => {
    const ctx = await buildTestApp();
    const old = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const res = await recover(ctx, { code: old[0] });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_code' });
  });

  it('dos requests concurrentes con el mismo código → exactamente uno 200', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const results = await Promise.all([
      recover(ctx, { code }, { ip: '203.0.113.10' }),
      recover(ctx, { code }, { ip: '203.0.113.11' }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);
    expect(await ctx.db.select().from(sessions)).toHaveLength(1);
  });

  it('6 intentos en una hora desde una IP → el 6º 429; pasada la hora vuelve a evaluar', async () => {
    const ctx = await buildTestApp();
    for (let i = 0; i < 5; i++) {
      expect((await recover(ctx, { code: WRONG_CODE })).status).toBe(401);
    }
    const sixth = await recover(ctx, { code: WRONG_CODE });
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: 'rate_limited' });
    expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);

    // Otra IP no está afectada.
    expect((await recover(ctx, { code: WRONG_CODE }, { ip: '203.0.113.99' })).status).toBe(401);

    ctx.clock.advance(60 * MIN);
    expect((await recover(ctx, { code: WRONG_CODE })).status).toBe(401);

    // La clave del límite usa la IP hasheada, nunca la IP en claro.
    const keys = (await ctx.db.select().from(rateLimits)).map((r) => r.key);
    expect(keys.some((k) => k.includes('203.0.113'))).toBe(false);
    expect(keys.some((k) => k.startsWith('recovery-ip:'))).toBe(true);
  });

  it('10 fallos globales desde IPs distintas → el 11º, aun con código válido, 429 sin consumirlo', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    await failFromTenIps(ctx);

    const locked = await recover(ctx, { code }, { ip: '192.0.2.200' });
    expect(locked.status).toBe(429);
    expect(locked.body).toEqual({ error: 'rate_limited' });
    expect(Number(locked.headers['retry-after'])).toBe(15 * 60);
    expect(sessionCookie(locked)).toBeUndefined();
    expect(await events(ctx, 'recovery_locked')).toHaveLength(1);
    expect(await events(ctx, 'recovery_failed')).toHaveLength(10);

    // El código no se evaluó: sigue sin usar y funciona al terminar el bloqueo.
    const unused = (await ctx.db.select().from(recoveryCodes)).filter((r) => r.usedAt === null);
    expect(unused).toHaveLength(10);
    ctx.clock.advance(15 * MIN);
    expect((await recover(ctx, { code }, { ip: '192.0.2.201' })).status).toBe(200);
  });

  it('un intento durante el bloqueo global no registra fallo ni acorta el bloqueo', async () => {
    const ctx = await buildTestApp();
    await failFromTenIps(ctx);
    const before = await globalLockRow(ctx);
    expect(before.failures).toBe(10);
    expect(before.lockedUntil.getTime()).toBe(ctx.clock.now().getTime() + 15 * MIN);

    ctx.clock.advance(5 * MIN);
    const res = await recover(ctx, { code: WRONG_CODE }, { ip: '192.0.2.50' });
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBe(10 * 60);

    const after = await globalLockRow(ctx);
    expect(after.failures).toBe(10);
    expect(after.lockedUntil.getTime()).toBe(before.lockedUntil.getTime());

    ctx.clock.advance(9 * MIN);
    expect((await recover(ctx, { code: WRONG_CODE }, { ip: '192.0.2.51' })).status).toBe(429);
  });

  it('un código con formato inválido es un fallo y cuenta para el bloqueo global', async () => {
    const ctx = await buildTestApp();
    const res = await recover(ctx, { code: 'no-es-un-codigo' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_code' });
    expect((await globalLockRow(ctx)).failures).toBe(1);
    expect(await events(ctx, 'recovery_failed')).toHaveLength(1);
  });

  it('body con campo extra → 400', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const res = await recover(ctx, { code, admin: true });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_input' });
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it('Origin ajeno o ausente → 403 sin evaluar el código', async () => {
    const ctx = await buildTestApp();
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    for (const origin of ['https://evil.test', null]) {
      const res = await recover(ctx, { code }, { origin });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'forbidden' });
    }
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
    expect(await globalLockRow(ctx)).toBeUndefined();
  });

  it('fuera de producción → 404', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false } });
    const [code] = await generateRecoveryCodes(ctx.db, ctx.clock.now());
    const res = await recover(ctx, { code });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
