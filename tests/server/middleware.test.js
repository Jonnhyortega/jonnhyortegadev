import { describe, it, expect } from 'vitest';
import { handle, config } from '../../middleware.js';

const PROD = { VERCEL_ENV: 'production', ADMIN_PATH: '/test-panel-path' };
const COOKIE = '__Host-panel-return=abc123';
const req = (path, { cookie } = {}) =>
  new Request(`https://example.com${path}`, { headers: cookie ? { cookie } : {} });

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

  it('redirige /__panel-return a la ruta secreta solo con la cookie de retorno', () => {
    const res = handle(req('/__panel-return', { cookie: COOKIE }), PROD);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')).pathname).toBe('/test-panel-path');
  });

  it('conserva solo error=1 al redirigir', () => {
    const res = handle(req('/__panel-return?error=1&x=2', { cookie: COOKIE }), PROD);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location'));
    expect(loc.pathname + loc.search).toBe('/test-panel-path?error=1');
  });

  it('borra la cookie de retorno al redirigir', () => {
    const res = handle(req('/__panel-return', { cookie: COOKIE }), PROD);
    const cleared = res.headers.get('set-cookie');
    expect(cleared).toMatch(/^__Host-panel-return=;/);
    expect(cleared).toMatch(/Max-Age=0/);
    expect(cleared).toMatch(/HttpOnly/);
    expect(cleared).toMatch(/Secure/);
    expect(cleared).toMatch(/SameSite=Lax/);
    expect(cleared).toMatch(/Path=\//);
  });

  it('sin la cookie, /__panel-return no revela la ruta (pasa de largo)', () => {
    expect(handle(req('/__panel-return'), PROD)).toBeUndefined();
    expect(handle(req('/__panel-return?error=1'), PROD)).toBeUndefined();
    expect(handle(req('/__panel-return', { cookie: 'otra=1' }), PROD)).toBeUndefined();
  });

  it('no redirige /__panel-return fuera de producción', () => {
    expect(
      handle(req('/__panel-return', { cookie: COOKIE }), { ...PROD, VERCEL_ENV: 'preview' }),
    ).toBeUndefined();
  });

  it.each([
    '/%61dmin.html',
    '/admin%2Ehtml',
    '//admin.html',
    '/ADMIN.HTML',
    '/admin.html/',
    '/x/../admin.html',
  ])('oculta variantes de /admin.html: %s', (path) => {
    expect(handle(req(path), PROD).status).toBe(404);
  });

  it('una ruta con codificación inválida da 404', () => {
    expect(handle(req('/%E0%A4%A'), PROD).status).toBe(404);
  });

  it('deja pasar el resto de las rutas', () => {
    expect(handle(req('/'), PROD)).toBeUndefined();
    expect(handle(req('/otra-ruta'), PROD)).toBeUndefined();
  });

  it('excluye assets y api del matcher', () => {
    expect(config.matcher).toEqual(['/((?!assets/|api/).*)']);
  });
});
