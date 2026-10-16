import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { buildTestApp } from './helpers/app.js';
import { loginAs } from './helpers/auth.js';

afterEach(() => vi.restoreAllMocks());

describe('esqueleto de la app', () => {
  it('404 genérico con cuerpo not_found', async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });

  it('cabeceras base', async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get('/api/no-existe');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('415 si una escritura no es application/json', async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post('/api/no-existe')
      .set('Content-Type', 'text/plain')
      .send('hola');
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'unsupported_media_type' });
  });

  it('413 si el JSON supera 64 KB', async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post('/api/no-existe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(70 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'payload_too_large' });
  });

  it('400 con JSON malformado', async () => {
    const { app } = await buildTestApp();
    const res = await request(app)
      .post('/api/no-existe')
      .set('Content-Type', 'application/json')
      .send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_json' });
  });

  it('500 genérico sin filtrar detalles internos', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testRoutes = Router();
    testRoutes.get('/api/boom', () => {
      throw new Error('detalle interno secreto');
    });
    const { app } = await buildTestApp({ testRoutes });
    const res = await request(app).get('/api/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal_error' });
    expect(res.text).not.toContain('detalle interno');
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('Cache-Control: no-store en /api/admin y /api/auth', () => {
  const ORIGIN = 'https://example.test';

  const fullSession = (ctx) => loginAs(ctx, 'full');

  it('respuestas correctas de /api/admin llevan no-store', async () => {
    const ctx = await buildTestApp();
    const { cookie } = await fullSession(ctx);
    for (const path of ['/api/admin/me', '/api/admin/security/sessions', '/api/admin/security/audit']) {
      const res = await request(ctx.app).get(path).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('el 404 de /api/admin sin sesión es idéntico al genérico, también en Cache-Control', async () => {
    const ctx = await buildTestApp();
    const generic = await request(ctx.app).get('/api/no-existe');
    const admin = await request(ctx.app).get('/api/admin/translations');
    expect(admin.status).toBe(404);
    expect(admin.text).toBe(generic.text);
    expect(admin.headers['content-type']).toBe(generic.headers['content-type']);
    expect(admin.headers['cache-control']).toBe(generic.headers['cache-control']);
    expect(generic.headers['cache-control']).toBe('no-store');
  });

  it('fuera de producción, los 404 de /api/admin y /api/auth también llevan no-store', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false, vercelEnv: 'preview' } });
    for (const path of ['/api/admin/me', '/api/auth/google/start']) {
      const res = await request(ctx.app).get(path);
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('errores de /api/auth y /api/admin (400, 403) llevan no-store', async () => {
    const ctx = await buildTestApp();
    const bad = await request(ctx.app)
      .post('/api/auth/recovery')
      .set('Origin', ORIGIN)
      .send({ otro: 1 });
    expect(bad.status).toBe(400);
    expect(bad.headers['cache-control']).toBe('no-store');

    const { cookie } = await fullSession(ctx);
    const forbidden = await request(ctx.app)
      .put('/api/admin/translations')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .send({});
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers['cache-control']).toBe('no-store');
  });
});
