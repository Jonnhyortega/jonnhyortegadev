import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { count, eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { loginAs } from './helpers/auth.js';
import { seedContent } from '../../server/db/seed.js';
import { auditLog, contentRevisions, projects } from '../../server/db/schema.js';
import { DEFAULT_TRANSLATIONS, DEFAULT_THEME } from '../../src/content/defaults.js';

const ORIGIN = 'https://example.test';

async function setup() {
  const ctx = await buildTestApp();
  await seedContent(ctx.db, ctx.clock.now());
  const session = await loginAs(ctx, 'full');
  const call = (method, url, body, { csrf = session.csrf, cookie = session.cookie } = {}) => {
    let req = request(ctx.app)[method](url).set('Cookie', cookie).set('Origin', ORIGIN);
    if (csrf) req = req.set('X-CSRF-Token', csrf);
    return body === undefined ? req : req.send(body);
  };
  return { ...ctx, session, call };
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const countProjects = async (db) => (await db.select({ n: count() }).from(projects))[0].n;

describe('admin translations', () => {
  it('GET devuelve data y version', async () => {
    const { call } = await setup();
    const res = await call('get', '/api/admin/translations');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: DEFAULT_TRANSLATIONS, version: 0 });
  });

  it('PUT con versión correcta: 200, versión +1, nueva revisión y se refleja en /api/content', async () => {
    const { call, db, app } = await setup();
    const data = clone(DEFAULT_TRANSLATIONS);
    data.en.hero.title = 'Nuevo título';
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.data.en.hero.title).toBe('Nuevo título');

    const revs = await db.select().from(contentRevisions).where(eq(contentRevisions.entity, 'translations'));
    expect(revs).toHaveLength(1);
    const pub = await request(app).get('/api/content');
    expect(pub.body.translations.en.hero.title).toBe('Nuevo título');
  });

  it('PUT con versión vieja: 409', async () => {
    const { call } = await setup();
    const data = clone(DEFAULT_TRANSLATIONS);
    await call('put', '/api/admin/translations', { data, version: 0 });
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'version_conflict' });
  });

  it('texto con intento de SQLi se guarda literal y projects queda intacto', async () => {
    const { call, db, app } = await setup();
    const before = await countProjects(db);
    const evil = "'; DROP TABLE projects; --";
    const data = clone(DEFAULT_TRANSLATIONS);
    data.en.hero.title = evil;
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.status).toBe(200);
    expect(await countProjects(db)).toBe(before);
    const pub = await request(app).get('/api/content');
    expect(pub.body.translations.en.hero.title).toBe(evil);
  });

  it('texto con HTML se guarda literal y la respuesta es application/json', async () => {
    const { call } = await setup();
    const xss = '<img src=x onerror=alert(1)>';
    const data = clone(DEFAULT_TRANSLATIONS);
    data.en.hero.title = xss;
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body.data.en.hero.title).toBe(xss);
  });

  it('texto con emoji vuelve idéntico', async () => {
    const { call } = await setup();
    const data = clone(DEFAULT_TRANSLATIONS);
    data.es.hero.title = 'Diseño 👋';
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.body.data.es.hero.title).toBe('Diseño 👋');
    const get = await call('get', '/api/admin/translations');
    expect(get.body.data.es.hero.title).toBe('Diseño 👋');
  });

  it('entrada inválida: 400 invalid_input con rutas y sin eco de valores', async () => {
    const { call } = await setup();
    const data = clone(DEFAULT_TRANSLATIONS);
    data.en.hero.title = 'x'.repeat(501);
    data.en.extra = 'SECRETO-ECO';
    const res = await call('put', '/api/admin/translations', { data, version: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_input');
    expect(res.body.fields).toEqual(expect.arrayContaining(['data.en.hero.title']));
    expect(JSON.stringify(res.body)).not.toContain('SECRETO-ECO');
    expect(JSON.stringify(res.body)).not.toContain('xxxxx');
  });

  it('registra content_updated con entity y action', async () => {
    const { call, db } = await setup();
    await call('put', '/api/admin/translations', { data: clone(DEFAULT_TRANSLATIONS), version: 0 });
    const rows = await db.select().from(auditLog).where(eq(auditLog.event, 'content_updated'));
    expect(rows).toHaveLength(1);
    expect(rows[0].meta).toEqual({ entity: 'translations', action: 'update' });
  });

  it('sin CSRF: 403; sesión recovery: 404', async () => {
    const ctx = await setup();
    const noCsrf = await ctx.call('put', '/api/admin/translations', { data: {}, version: 0 }, { csrf: null });
    expect(noCsrf.status).toBe(403);
    const rec = await loginAs(ctx, 'recovery');
    const res = await ctx.call('get', '/api/admin/translations', undefined, { csrf: rec.csrf, cookie: rec.cookie });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});

describe('admin theme', () => {
  it('GET y PUT con control de versión', async () => {
    const { call, app } = await setup();
    const get = await call('get', '/api/admin/theme');
    expect(get.body).toEqual({ data: DEFAULT_THEME, version: 0 });
    const data = { ...DEFAULT_THEME, primary: '#112233' };
    const res = await call('put', '/api/admin/theme', { data, version: 0 });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    const pub = await request(app).get('/api/content');
    expect(pub.body.theme.colors.primary).toBe('#112233');
    const stale = await call('put', '/api/admin/theme', { data, version: 0 });
    expect(stale.status).toBe(409);
  });

  it('color inválido: 400 con ruta del campo', async () => {
    const { call } = await setup();
    const res = await call('put', '/api/admin/theme', { data: { ...DEFAULT_THEME, primary: 'red' }, version: 0 });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual(['data.primary']);
  });
});
