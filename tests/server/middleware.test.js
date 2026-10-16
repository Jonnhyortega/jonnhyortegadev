import { describe, it, expect } from 'vitest';
import { handle, config } from '../../middleware.js';

const PROD = { VERCEL_ENV: 'production', ADMIN_PATH: '/test-panel-path' };
const req = (path) => new Request(`https://example.com${path}`);

describe('middleware del panel', () => {
  it('oculta /admin.html con un 404', async () => {
    const res = handle(req('/admin.html'), PROD);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not Found');
  });

  it('oculta /admin.html también fuera de producción', () => {
    expect(handle(req('/admin.html'), { VERCEL_ENV: 'preview' }).status).toBe(404);
  });

  it('reescribe la ruta secreta a /admin.html en producción', () => {
    const res = handle(req('/test-panel-path'), PROD);
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/admin\.html$/);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('no hace nada con la ruta secreta fuera de producción', () => {
    expect(handle(req('/test-panel-path'), { ...PROD, VERCEL_ENV: 'preview' })).toBeUndefined();
  });

  it('no hace nada si ADMIN_PATH no está definido', () => {
    expect(handle(req('/test-panel-path'), { VERCEL_ENV: 'production' })).toBeUndefined();
  });

  it('redirige /__panel-return a la ruta secreta', () => {
    const res = handle(req('/__panel-return'), PROD);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')).pathname).toBe('/test-panel-path');
  });

  it('conserva ?error=1 al redirigir', () => {
    const res = handle(req('/__panel-return?error=1'), PROD);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location'));
    expect(loc.pathname + loc.search).toBe('/test-panel-path?error=1');
  });

  it('no redirige /__panel-return fuera de producción', () => {
    expect(handle(req('/__panel-return'), { ...PROD, VERCEL_ENV: 'preview' })).toBeUndefined();
  });

  it('deja pasar el resto de las rutas', () => {
    expect(handle(req('/'), PROD)).toBeUndefined();
    expect(handle(req('/otra-ruta'), PROD)).toBeUndefined();
  });

  it('excluye assets y api del matcher', () => {
    expect(config.matcher).toEqual(['/((?!assets/|api/).*)']);
  });
});
