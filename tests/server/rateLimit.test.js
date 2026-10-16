import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { createTestDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';
import { consume, registerFailure, getLock } from '../../server/services/rateLimit.js';
import { rateLimit } from '../../server/middleware/rateLimit.js';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const MIN = 60_000;

describe('consume', () => {
  it('permite 10 y bloquea la 11ª en la ventana; se reinicia tras 60 s', async () => {
    const db = await createTestDb();
    for (let i = 0; i < 10; i++) {
      const r = await consume(db, { key: 'k', limit: 10, windowMs: MIN, now: T0 });
      expect(r.allowed).toBe(true);
    }
    const blocked = await consume(db, { key: 'k', limit: 10, windowMs: MIN, now: T0 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(MIN);

    const later = new Date(T0.getTime() + MIN);
    const again = await consume(db, { key: 'k', limit: 10, windowMs: MIN, now: later });
    expect(again.allowed).toBe(true);
  });

  it('20 llamadas concurrentes con límite 10 permiten exactamente 10', async () => {
    const db = await createTestDb();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        consume(db, { key: 'c', limit: 10, windowMs: MIN, now: T0 }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });
});

describe('registerFailure / getLock', () => {
  async function fail(db, n, now) {
    let last;
    for (let i = 0; i < n; i++) last = await registerFailure(db, { key: 'rec', now });
    return last;
  }

  it('escala de bloqueo 10 -> 15 min, 15 -> 1 h, 20 -> 24 h', async () => {
    const db = await createTestDb();
    const r9 = await fail(db, 9, T0);
    expect(r9.lockedUntil).toBeNull();
    expect(await getLock(db, { key: 'rec', now: T0 })).toBeNull();

    const r10 = await fail(db, 1, T0);
    expect(r10.lockedUntil).toEqual(new Date(T0.getTime() + 15 * MIN));
    expect(await getLock(db, { key: 'rec', now: T0 })).toEqual(r10.lockedUntil);
    // Pasado el bloqueo ya no aplica.
    const after = new Date(T0.getTime() + 16 * MIN);
    expect(await getLock(db, { key: 'rec', now: after })).toBeNull();

    const r15 = await fail(db, 5, T0);
    expect(r15.lockedUntil).toEqual(new Date(T0.getTime() + 60 * MIN));

    const r20 = await fail(db, 5, T0);
    expect(r20.lockedUntil).toEqual(new Date(T0.getTime() + 24 * 60 * MIN));
  });

  it('reinicia los fallos tras 24 h sin fallos', async () => {
    const db = await createTestDb();
    await fail(db, 9, T0);
    const later = new Date(T0.getTime() + 24 * 60 * MIN + 1);
    const r = await registerFailure(db, { key: 'rec', now: later });
    expect(r.lockedUntil).toBeNull(); // sería el 10º sin reinicio
  });
});

describe('middleware rateLimit', () => {
  it('responde 429 con Retry-After y cuerpo rate_limited', async () => {
    const db = await createTestDb();
    const testRoutes = Router();
    let clockRef;
    testRoutes.post(
      '/api/test-limited',
      (req, res, next) =>
        rateLimit({
          db,
          now: () => clockRef.now(),
          name: 'login',
          limit: 2,
          windowMs: MIN,
          keyFrom: (r) => r.ip,
        })(req, res, next),
      (_req, res) => res.json({ ok: true }),
    );
    const { app, clock } = await buildTestApp({ db, testRoutes });
    clockRef = clock;

    expect((await request(app).post('/api/test-limited').send({})).status).toBe(200);
    expect((await request(app).post('/api/test-limited').send({})).status).toBe(200);
    const res = await request(app).post('/api/test-limited').send({});
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'rate_limited' });
    expect(res.headers['retry-after']).toBe('60');

    clock.advance(MIN);
    expect((await request(app).post('/api/test-limited').send({})).status).toBe(200);
  });
});
