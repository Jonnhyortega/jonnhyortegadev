import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import { buildTestApp } from './helpers/app.js';

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
