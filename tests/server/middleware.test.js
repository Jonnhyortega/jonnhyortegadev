import { describe, it, expect } from 'vitest';
import { handle, config } from '../../middleware.js';
import { signPanelReturn } from '../../server/lib/panelReturn.js';

const SECRET = 'test-panel-return-secret-0123456789abcdef';
const PROD = { VERCEL_ENV: 'production', ADMIN_PATH: '/test-panel-path', PANEL_RETURN_SECRET: SECRET };
const signed = async (secret = SECRET, offsetMs = 60_000) =>
  `__Host-panel-return=${await signPanelReturn(secret, Date.now() + offsetMs)}`;
const req = (path, { cookie } = {}) =>
  new Request(`https://example.com${path}`, { headers: cookie ? { cookie } : {} });

describe('middleware del panel', () => {
  it('oculta /admin.html con un 404', async () => {
    const res = await handle(req('/admin.html'), PROD);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Not Found');
  });

  it('oculta /admin.html también fuera de producción', async () => {
    expect((await handle(req('/admin.html'), { VERCEL_ENV: 'preview' })).status).toBe(404);
  });

  it('reescribe la ruta secreta a /admin.html en producción', async () => {
    const res = await handle(req('/test-panel-path'), PROD);
    expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/admin\.html$/);
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('no hace nada con la ruta secreta fuera de producción', async () => {
    expect(await handle(req('/test-panel-path'), { ...PROD, VERCEL_ENV: 'preview' })).toBeUndefined();
  });

  it('no hace nada si ADMIN_PATH no está definido', async () => {
    expect(await handle(req('/test-panel-path'), { VERCEL_ENV: 'production' })).toBeUndefined();
  });

  it('redirige /__panel-return a la ruta secreta solo con la cookie de retorno', async () => {
    const res = await handle(req('/__panel-return', { cookie: await signed() }), PROD);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get('location')).pathname).toBe('/test-panel-path');
  });

  it('conserva solo error=1 al redirigir', async () => {
    const res = await handle(req('/__panel-return?error=1&x=2', { cookie: await signed() }), PROD);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('location'));
    expect(loc.pathname + loc.search).toBe('/test-panel-path?error=1');
  });

  it('borra la cookie de retorno al redirigir', async () => {
    const res = await handle(req('/__panel-return', { cookie: await signed() }), PROD);
    const cleared = res.headers.get('set-cookie');
    expect(cleared).toMatch(/^__Host-panel-return=;/);
    expect(cleared).toMatch(/Max-Age=0/);
    expect(cleared).toMatch(/HttpOnly/);
    expect(cleared).toMatch(/Secure/);
    expect(cleared).toMatch(/SameSite=Lax/);
    expect(cleared).toMatch(/Path=\//);
  });

  it('sin la cookie, /__panel-return no revela la ruta (pasa de largo)', async () => {
    expect(await handle(req('/__panel-return'), PROD)).toBeUndefined();
    expect(await handle(req('/__panel-return?error=1'), PROD)).toBeUndefined();
    expect(await handle(req('/__panel-return', { cookie: 'otra=1' }), PROD)).toBeUndefined();
  });

  it('una cookie falsificada no revela la ruta', async () => {
    for (const value of ['x', '123.abc', '', 'a.b.c']) {
      const cookie = `__Host-panel-return=${value}`;
      expect(await handle(req('/__panel-return', { cookie }), PROD)).toBeUndefined();
    }
  });

  it('una firma vencida no revela la ruta', async () => {
    const cookie = await signed(SECRET, -1000);
    expect(await handle(req('/__panel-return', { cookie }), PROD)).toBeUndefined();
  });

  it('una firma con otro secreto no revela la ruta', async () => {
    const cookie = await signed('otro-secreto-otro-secreto-otro-secreto-12');
    expect(await handle(req('/__panel-return', { cookie }), PROD)).toBeUndefined();
  });

  it('una marca de tiempo alterada no revela la ruta', async () => {
    const [name, value] = (await signed()).split('=');
    const [ts, sig] = value.split('.');
    const cookie = `${name}=${Number(ts) + 1000}.${sig}`;
    expect(await handle(req('/__panel-return', { cookie }), PROD)).toBeUndefined();
  });

  it('una firma con vencimiento demasiado lejano no revela la ruta', async () => {
    const cookie = await signed(SECRET, 10 * 60_000);
    expect(await handle(req('/__panel-return', { cookie }), PROD)).toBeUndefined();
  });

  it('sin PANEL_RETURN_SECRET no redirige', async () => {
    const env = { ...PROD, PANEL_RETURN_SECRET: undefined };
    expect(await handle(req('/__panel-return', { cookie: await signed() }), env)).toBeUndefined();
  });

  it('no redirige /__panel-return fuera de producción', async () => {
    expect(
      await handle(req('/__panel-return', { cookie: await signed() }), { ...PROD, VERCEL_ENV: 'preview' }),
    ).toBeUndefined();
  });

  it.each([
    '/%61dmin.html',
    '/admin%2Ehtml',
    '//admin.html',
    '/ADMIN.HTML',
    '/admin.html/',
    '/x/../admin.html',
  ])('oculta variantes de /admin.html: %s', async (path) => {
    expect((await handle(req(path), PROD)).status).toBe(404);
  });

  it('una ruta con codificación inválida da 404', async () => {
    expect((await handle(req('/%E0%A4%A'), PROD)).status).toBe(404);
  });

  it('deja pasar el resto de las rutas', async () => {
    expect(await handle(req('/'), PROD)).toBeUndefined();
    expect(await handle(req('/otra-ruta'), PROD)).toBeUndefined();
  });

  it('excluye assets y api del matcher', async () => {
    expect(config.matcher).toEqual(['/((?!assets/|api/).*)']);
  });
});
