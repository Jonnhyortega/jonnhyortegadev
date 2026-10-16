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

const validProject = (over = {}) => ({
  title: 'Nuevo proyecto',
  descriptionEn: 'English description',
  descriptionEs: 'Descripción en español',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/a.png',
  liveUrl: null,
  githubUrl: null,
  tech: ['react'],
  published: true,
  ...over,
});

const projectIds = async (call) => (await call('get', '/api/admin/projects')).body.map((p) => p.id);

describe('admin projects', () => {
  it('GET lista incluyendo no publicados, con position/version/published', async () => {
    const { call, db } = await setup();
    await db.update(projects).set({ published: false }).where(eq(projects.position, 0));
    const res = await call('get', '/api/admin/projects');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ position: 0, version: 0, published: false });
    expect(res.body[0]).toHaveProperty('id');
  });

  it('POST válido: 201, al final, URL canónica y se refleja en /api/content', async () => {
    const { call, app } = await setup();
    const before = (await projectIds(call)).length;
    const res = await call('post', '/api/admin/projects', validProject({ imageUrl: 'https://RES.cloudinary.com/demo/a.png' }));
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(before);
    expect(res.body.imageUrl).toBe('https://res.cloudinary.com/demo/a.png');
    const pub = await request(app).get('/api/content');
    expect(pub.body.projects.at(-1).title).toBe('Nuevo proyecto');
  });

  it('POST con imageUrl de otro host: 400 con fields y sin eco del valor', async () => {
    const { call, db } = await setup();
    const before = await countProjects(db);
    const res = await call('post', '/api/admin/projects', validProject({ imageUrl: 'https://evil.example/pwn.png' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_input');
    expect(res.body.fields).toContain('imageUrl');
    expect(JSON.stringify(res.body)).not.toContain('evil');
    expect(await countProjects(db)).toBe(before);
  });

  it('POST con más de 50 proyectos: 400 limit_reached', async () => {
    const { call, db, clock } = await setup();
    const current = await countProjects(db);
    const rows = Array.from({ length: 50 - current }, (_, i) => ({
      slug: `relleno-${i}`,
      position: 100 + i,
      title: 't',
      descriptionEn: 'd',
      descriptionEs: 'd',
      imageUrl: 'https://res.cloudinary.com/demo/a.png',
      tech: ['react'],
      createdAt: clock.now(),
      updatedAt: clock.now(),
    }));
    await db.insert(projects).values(rows);
    const res = await call('post', '/api/admin/projects', validProject());
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'limit_reached' });
  });

  it('PUT /:id con versión correcta actualiza; con vieja da 409; inexistente da 404', async () => {
    const { call } = await setup();
    const [id] = await projectIds(call);
    const ok = await call('put', `/api/admin/projects/${id}`, { data: validProject({ title: 'Editado' }), version: 0 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id, title: 'Editado', version: 1 });
    const stale = await call('put', `/api/admin/projects/${id}`, { data: validProject(), version: 0 });
    expect(stale.status).toBe(409);
    const missing = await call('put', '/api/admin/projects/00000000-0000-4000-8000-000000000000', {
      data: validProject(),
      version: 0,
    });
    expect(missing.status).toBe(404);
  });

  it('DELETE borra y responde 204; id inexistente 404', async () => {
    const { call } = await setup();
    const ids = await projectIds(call);
    const res = await call('delete', `/api/admin/projects/${ids[0]}`);
    expect(res.status).toBe(204);
    expect(await projectIds(call)).toEqual(ids.slice(1));
    const again = await call('delete', `/api/admin/projects/${ids[0]}`);
    expect(again.status).toBe(404);
  });

  it('DELETE con id "1 OR 1=1": 404 y no se borra nada', async () => {
    const { call, db } = await setup();
    const before = await countProjects(db);
    const res = await call('delete', `/api/admin/projects/${encodeURIComponent('1 OR 1=1')}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect(await countProjects(db)).toBe(before);
  });

  it('PUT /order con una permutación exacta reordena', async () => {
    const { call } = await setup();
    const ids = await projectIds(call);
    const reversed = [...ids].reverse();
    const res = await call('put', '/api/admin/projects/order', { ids: reversed });
    expect(res.status).toBe(200);
    expect(await projectIds(call)).toEqual(reversed);
  });

  it('PUT /order incompleto, duplicado o con id inexistente: 400 y orden sin cambios', async () => {
    const { call } = await setup();
    const ids = await projectIds(call);
    const ghost = '00000000-0000-4000-8000-000000000000';
    const cases = [
      ids.slice(1),
      [ids[0], ...ids.slice(0, -1)],
      [...ids.slice(0, -1), ghost],
    ];
    for (const bad of cases) {
      const res = await call('put', '/api/admin/projects/order', { ids: bad });
      expect(res.status).toBe(400);
      expect(await projectIds(call)).toEqual(ids);
    }
  });

  it('escrituras registran content_updated con la acción', async () => {
    const { call, db } = await setup();
    const created = await call('post', '/api/admin/projects', validProject());
    await call('delete', `/api/admin/projects/${created.body.id}`);
    const rows = await db.select().from(auditLog).where(eq(auditLog.event, 'content_updated'));
    expect(rows.map((r) => r.meta)).toEqual([
      { entity: 'projects', action: 'create', projectId: created.body.id },
      { entity: 'projects', action: 'delete', projectId: created.body.id },
    ]);
  });

  it('sin CSRF: 403; sesión recovery: 404', async () => {
    const ctx = await setup();
    const noCsrf = await ctx.call('post', '/api/admin/projects', validProject(), { csrf: null });
    expect(noCsrf.status).toBe(403);
    const rec = await loginAs(ctx, 'recovery');
    const res = await ctx.call('get', '/api/admin/projects', undefined, { csrf: rec.csrf, cookie: rec.cookie });
    expect(res.status).toBe(404);
  });
});
